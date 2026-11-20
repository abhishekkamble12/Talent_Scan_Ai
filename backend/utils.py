import os
import logging
from typing import List, Tuple, Union
from pathlib import Path
from dotenv import load_dotenv

from langchain_chroma import Chroma
try:
    from langchain_core.prompts import ChatPromptTemplate
except ImportError:
    from langchain.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

# Load .env from project root or current working dir
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()


def get_api_key() -> str:
    key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    return key.strip() if key else ""


def query_rag(job_description: str, question: str, database_path: str = None) -> str:
    """
    Queries the RAG pipeline using ChromaDB context and Gemini 1.5 Flash.
    """
    PROMPT_TEMPLATE = """
You are an expert HR Technical Recruiter and Talent Screener assistant.
Your task is to analyze candidate resumes in relation to the Job Description, and answer questions with high precision and actionable insights.

---
### JOB DESCRIPTION:
{job_description}

---
### CANDIDATE RESUMES CONTEXT:
{context}

---
### QUESTION / SCREENING REQUEST:
{question}

---
### INSTRUCTIONS:
- Base your answers directly on the candidate resumes provided in the context.
- Highlight specific strengths, matched skills, gaps, or flags where relevant.
- Format your response clearly using markdown headings, bullet points, and bold candidate names.
- Keep your analysis concise, structured, and actionable (around 200-350 words).
- If no candidates match a specific criterion, state that objectively.
"""

    api_key = get_api_key()
    if not api_key or "your_gemini_api_key_here" in api_key.lower():
        return (
            "⚠️ **Gemini API Key Missing:** Please set your `GOOGLE_API_KEY` in the `.env` file at the root of the project to enable AI responses.\n\n"
            "You can obtain a free API key at [Google AI Studio](https://aistudio.google.com/)."
        )

    if not database_path:
        # Default to chroma dir at project root
        database_path = str(Path(__file__).resolve().parent.parent / "chroma")

    if not os.path.exists(database_path):
        return "⚠️ **No resumes indexed yet.** Please upload candidate resumes and a job description first."

    try:
        embedding_model = os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")
        embeddings = GoogleGenerativeAIEmbeddings(
            model=embedding_model,
            google_api_key=api_key,
        )

        db = Chroma(
            persist_directory=database_path,
            embedding_function=embeddings,
        )

        all_ids = db.get(include=[])
        total_docs = len(all_ids.get("ids", []))
        if total_docs == 0:
            return "⚠️ **Resume database is empty.** Please upload candidate resumes in PDF format before querying."

        # Search using both the question and job description to find the most relevant chunks
        search_query = f"{question} {job_description[:400]}"
        k_val = min(total_docs, 6)

        results = db.similarity_search_with_score(search_query, k=k_val)

        if not results:
            return "No matching resume information could be retrieved for this query."

        context_text = "\n\n---\n\n".join([doc.page_content for doc, _score in results])

        prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
        prompt = prompt_template.format(
            job_description=job_description if job_description.strip() else "General Technical Screening",
            context=context_text,
            question=question,
        )

        candidate_models = [
            os.getenv("GEMINI_CHAT_MODEL", "gemini-3.5-flash-lite"),
            "gemini-flash-lite-latest",
            "gemini-3.8-flash",
            "gemini-flash-latest",
        ]
        response = None
        last_error = None
        for m_name in candidate_models:
            try:
                model = ChatGoogleGenerativeAI(
                    model=m_name,
                    google_api_key=api_key,
                    max_output_tokens=1024,
                    max_retries=1,
                    timeout=20,
                )
                response = model.invoke(prompt)
                break
            except Exception as model_err:
                last_error = model_err
                logging.warning(f"Model {m_name} failed: {model_err}, trying fallback...")

        if response is None:
            raise last_error

        raw_content = response.content if hasattr(response, "content") else str(response)
        if isinstance(raw_content, str):
            return raw_content.strip()
        elif isinstance(raw_content, list):
            parts = []
            for item in raw_content:
                if isinstance(item, dict) and "text" in item:
                    parts.append(item["text"])
                elif isinstance(item, str):
                    parts.append(item)
                elif hasattr(item, "text"):
                    parts.append(item.text)
                else:
                    parts.append(str(item))
            return "\n".join(parts).strip()
        return str(raw_content).strip()

    except Exception as e:
        logging.error(f"Error in query_rag: {e}", exc_info=True)
        return f"❌ **An error occurred while analyzing resumes:** {str(e)}"
