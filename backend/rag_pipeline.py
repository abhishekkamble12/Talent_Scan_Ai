import os
import shutil
import logging
from typing import List, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_google_genai import GoogleGenerativeAIEmbeddings
try:
    from langchain_core.documents import Document
except ImportError:
    from langchain.schema.document import Document
import argparse

# Load .env from project root or backend
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()


class RAGPipeline:
    def __init__(self, data_path: str, database_path: str, document_type: str = "pdf") -> None:
        self.data_path = os.path.abspath(data_path)
        self.database_path = os.path.abspath(database_path)
        self.document_type = document_type

    def get_api_key(self) -> str:
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        return api_key.strip() if api_key else ""

    def load_documents(self) -> List[Document]:
        if not os.path.exists(self.data_path):
            logging.warning(f"Data path does not exist: {self.data_path}")
            return []

        loader = {
            "pdf": PyPDFDirectoryLoader(
                self.data_path,
                glob="*.pdf",
            ),
        }

        if self.document_type not in loader:
            raise ValueError(f"Unsupported document type: {self.document_type}")

        documents = loader[self.document_type].load()
        logging.info(f"Loaded {len(documents)} document pages from {self.data_path}")
        return documents

    def chunk_documents(self, documents: List[Document]) -> List[Document]:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=80,
            length_function=len,
            is_separator_regex=False,
        )
        chunks = splitter.split_documents(documents)
        logging.info(f"Split into {len(chunks)} text chunks")
        return chunks

    def calculate_chunk_ids(self, chunks: List[Document]) -> List[Document]:
        last_page_id = None
        current_chunk_index = 0

        for chunk in chunks:
            source = chunk.metadata.get("source")
            page = chunk.metadata.get("page", 0)
            current_page_id = f"{source}:{page}"

            if current_page_id == last_page_id:
                current_chunk_index += 1
            else:
                current_chunk_index = 0

            chunk_id = f"{current_page_id}:{current_chunk_index}"
            last_page_id = current_page_id
            chunk.metadata["id"] = chunk_id

        return chunks

    def populate_chroma(self, chunks: List[Document]) -> Dict[str, Any]:
        api_key = self.get_api_key()
        if not api_key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY is not set in environment or .env file.")

        embedding_model = os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")
        embeddings = GoogleGenerativeAIEmbeddings(
            model=embedding_model,
            google_api_key=api_key,
        )

        try:
            db = Chroma(
                persist_directory=self.database_path,
                embedding_function=embeddings,
            )
            existing_items = db.get(include=[])
            existing_ids = set(existing_items.get("ids", []))
        except Exception as init_err:
            if "dimension" in str(init_err).lower():
                logging.warning("Embedding dimension mismatch in existing Chroma store. Resetting database...")
                self.clear_database()
                db = Chroma(
                    persist_directory=self.database_path,
                    embedding_function=embeddings,
                )
                existing_ids = set()
            else:
                raise init_err

        chunks_with_ids = self.calculate_chunk_ids(chunks)
        logging.info(f"Existing chunks in DB: {len(existing_ids)}")

        new_chunks = [chunk for chunk in chunks_with_ids if chunk.metadata["id"] not in existing_ids]

        if new_chunks:
            logging.info(f"Adding {len(new_chunks)} new chunks to vector store...")
            new_chunk_ids = [chunk.metadata["id"] for chunk in new_chunks]
            try:
                db.add_documents(new_chunks, ids=new_chunk_ids)
            except Exception as add_err:
                if "dimension" in str(add_err).lower():
                    logging.warning("Dimension mismatch during upsert. Clearing Chroma and retrying...")
                    self.clear_database()
                    db = Chroma(
                        persist_directory=self.database_path,
                        embedding_function=embeddings,
                    )
                    db.add_documents(new_chunks, ids=new_chunk_ids)
                else:
                    raise add_err
            added_count = len(new_chunks)
        else:
            logging.info("No new documents to add")
            added_count = 0

        total_chunks = len(existing_ids) + added_count
        return {
            "total_chunks": total_chunks,
            "new_chunks_added": added_count,
            "chunks_created": len(chunks),
        }

    def clear_database(self) -> None:
        if os.path.exists(self.database_path):
            shutil.rmtree(self.database_path)
            logging.info(f"Cleared database at {self.database_path}")

    def run_pipeline(self) -> Dict[str, Any]:
        import time
        from aiops_metrics import metrics_store
        
        start_time = time.perf_counter()
        try:
            documents = self.load_documents()
            if not documents:
                res = {"status": "empty", "message": "No documents found to process.", "total_chunks": 0}
                metrics_store.log_pipeline_run(0, 0, 0, 0, status="empty")
                return res
            chunks = self.chunk_documents(documents)
            stats = self.populate_chroma(chunks)
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            
            stats["status"] = "success"
            stats["documents_loaded"] = len(documents)
            stats["pipeline_latency_ms"] = round(elapsed_ms, 2)
            
            metrics_store.log_pipeline_run(
                docs_loaded=len(documents),
                chunks_created=stats.get("chunks_created", len(chunks)),
                chunks_added=stats.get("new_chunks_added", 0),
                latency_ms=round(elapsed_ms, 2),
                status="success"
            )
            return stats
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            metrics_store.log_pipeline_run(
                docs_loaded=0,
                chunks_created=0,
                chunks_added=0,
                latency_ms=round(elapsed_ms, 2),
                status="error",
                error=str(e)[:250]
            )
            raise e


def main() -> None:
    arg_parse = argparse.ArgumentParser(
        prog="Run data pipeline.",
        description="Script to run the entire data pipeline.",
    )
    arg_parse.add_argument("--document_type", type=str, default="pdf")
    arg_parse.add_argument("--directory", type=str, required=True)
    arg_parse.add_argument("--database", type=str, default="chroma")
    args = arg_parse.parse_args()

    rag_pipeline = RAGPipeline(
        data_path=args.directory,
        database_path=args.database,
        document_type=args.document_type,
    )
    result = rag_pipeline.run_pipeline()
    print("Pipeline result:", result)


if __name__ == "__main__":
    main()
