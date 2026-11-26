import os
import logging
import time
import uuid
from typing import List, Tuple, Union
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

from langchain_chroma import Chroma
try:
    from langchain_core.prompts import ChatPromptTemplate
except ImportError:
    from langchain.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

from aiops_metrics import metrics_store, QueryMetrics
from aiops_evaluator import evaluate_async

# Load .env from project root or current working dir
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()


def get_api_key() -> str:
    key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    return key.strip() if key else ""


def estimate_tokens(text: str) -> int:
    """Approximate token count (~4 characters per token for English)."""
    return max(1, len(text) // 4) if text else 0


def query_rag(job_description: str, question: str, database_path: str = None) -> str:
    """
    Queries the RAG pipeline using ChromaDB context and Gemini Flash,
    fully instrumented with AIOps metrics collection and async auto-eval.
    """
    query_id = str(uuid.uuid4())[:8]
    metrics = QueryMetrics(
        query_id=query_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        question=question[:300],
    )
    e2e_start = time.perf_counter()

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
        metrics.status = "error"
        metrics.error_message = "Gemini API key missing"
        metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
        metrics_store.log_query(metrics)
        return (
            "⚠️ **Gemini API Key Missing:** Please set your `GOOGLE_API_KEY` in the `.env` file at the root of the project to enable AI responses.\n\n"
            "You can obtain a free API key at [Google AI Studio](https://aistudio.google.com/)."
        )

    if not database_path:
        database_path = str(Path(__file__).resolve().parent.parent / "chroma")

    if not os.path.exists(database_path):
        metrics.status = "error"
        metrics.error_message = "Vector database directory not found"
        metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
        metrics_store.log_query(metrics)
        return "⚠️ **No resumes indexed yet.** Please upload candidate resumes and a job description first."

    try:
        # ── 1. Embedding Model Setup ──
        embed_start = time.perf_counter()
        embedding_model = os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")
        embeddings = GoogleGenerativeAIEmbeddings(
            model=embedding_model,
            google_api_key=api_key,
        )

        db = Chroma(
            persist_directory=database_path,
            embedding_function=embeddings,
        )
        metrics.embedding_latency_ms = round((time.perf_counter() - embed_start) * 1000, 2)

        all_ids = db.get(include=[])
        total_docs = len(all_ids.get("ids", []))
        if total_docs == 0:
            metrics.status = "error"
            metrics.error_message = "Vector database contains zero indexed chunks"
            metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
            metrics_store.log_query(metrics)
            return "⚠️ **Resume database is empty.** Please upload candidate resumes in PDF format before querying."

        # ── 2. Vector Retrieval ──
        retrieval_start = time.perf_counter()
        search_query = f"{question} {job_description[:400]}"
        k_val = min(total_docs, 6)

        results = db.similarity_search_with_score(search_query, k=k_val)
        metrics.retrieval_latency_ms = round((time.perf_counter() - retrieval_start) * 1000, 2)

        if not results:
            metrics.status = "error"
            metrics.error_message = "No matching chunks found"
            metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
            metrics_store.log_query(metrics)
            return "No matching resume information could be retrieved for this query."

        # Compute retrieval quality metrics
        scores = [float(score) for _, score in results]
        unique_files = set()
        for doc, _ in results:
            src = doc.metadata.get("source", "")
            if src:
                unique_files.add(Path(src).name)

        metrics.chunks_retrieved = len(results)
        metrics.avg_similarity_score = round(sum(scores) / len(scores), 4)
        metrics.min_similarity_score = round(min(scores), 4)
        metrics.max_similarity_score = round(max(scores), 4)
        metrics.unique_sources = len(unique_files)

        context_text = "\n\n---\n\n".join([doc.page_content for doc, _ in results])
        metrics.context_length_chars = len(context_text)

        # ── 3. Prompt Assembly ──
        prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
        prompt = prompt_template.format(
            job_description=job_description if job_description.strip() else "General Technical Screening",
            context=context_text,
            question=question,
        )
        metrics.estimated_input_tokens = estimate_tokens(prompt)

        # ── 4. LLM Generation ──
        llm_start = time.perf_counter()
        candidate_models = [
            os.getenv("GEMINI_CHAT_MODEL", "gemini-2.5-flash"),
            "gemini-flash-latest",
            "gemini-3.5-flash-lite",
            "gemini-3.8-flash",
        ]
        response = None
        last_error = None
        fallback_count = 0
        model_used = ""

        for m_name in candidate_models:
            try:
                model = ChatGoogleGenerativeAI(
                    model=m_name,
                    google_api_key=api_key,
                    max_output_tokens=1024,
                    max_retries=1,
                    timeout=25,
                )
                response = model.invoke(prompt)
                model_used = m_name
                break
            except Exception as model_err:
                last_error = model_err
                fallback_count += 1
                logging.warning(f"[AIOps] Model {m_name} failed: {model_err}, trying fallback...")

        metrics.llm_latency_ms = round((time.perf_counter() - llm_start) * 1000, 2)
        metrics.model_used = model_used
        metrics.model_fallback_count = fallback_count

        if response is None:
            metrics.status = "error"
            metrics.error_message = str(last_error)[:200]
            metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
            metrics_store.log_query(metrics)
            raise last_error

        # Format output text
        raw_content = response.content if hasattr(response, "content") else str(response)
        if isinstance(raw_content, list):
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
            answer_text = "\n".join(parts).strip()
        else:
            answer_text = str(raw_content).strip()

        metrics.response_length_chars = len(answer_text)
        metrics.estimated_output_tokens = estimate_tokens(answer_text)
        metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
        metrics.status = "success"

        # Pricing estimation for Gemini 1.5/2.5 Flash tier (~$0.075 / 1M input, ~$0.30 / 1M output)
        metrics.estimated_cost_usd = round(
            (metrics.estimated_input_tokens * 0.000000075) + 
            (metrics.estimated_output_tokens * 0.0000003), 6
        )

        # Log query metrics immediately to SQLite
        metrics_store.log_query(metrics)

        # ── 5. Trigger Async Auto-Evaluation ──
        def handle_eval_result(qid: str, scores: dict):
            metrics_store.update_evaluation(qid, scores)

        evaluate_async(
            query_id=query_id,
            question=question,
            context=context_text,
            answer=answer_text,
            api_key=api_key,
            callback=handle_eval_result
        )

        return answer_text

    except Exception as e:
        metrics.status = "error"
        metrics.error_message = str(e)[:250]
        metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
        metrics_store.log_query(metrics)
        logging.error(f"Error in query_rag: {e}", exc_info=True)
        return f"❌ **An error occurred while analyzing resumes:** {str(e)}"
