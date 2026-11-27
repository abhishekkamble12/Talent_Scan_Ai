import os
import logging
import time
import uuid
import threading
from typing import List, Tuple, Union, Optional
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

# Singleton Chroma and Embeddings cache
_CHROMA_LOCK = threading.Lock()
_CACHED_CHROMA: Optional[Chroma] = None
_CACHED_EMBEDDINGS: Optional[GoogleGenerativeAIEmbeddings] = None
_CACHED_DB_PATH: Optional[str] = None
_CACHED_API_KEY: Optional[str] = None


def invalidate_chroma_cache():
    """Invalidates the cached Chroma and Embeddings singletons (called on upload/reset)."""
    global _CACHED_CHROMA, _CACHED_EMBEDDINGS, _CACHED_DB_PATH, _CACHED_API_KEY
    with _CHROMA_LOCK:
        _CACHED_CHROMA = None
        _CACHED_EMBEDDINGS = None
        _CACHED_DB_PATH = None
        _CACHED_API_KEY = None
    logging.info("[AIOps] Invalidate ChromaDB and Embeddings singleton cache.")


def get_chroma_store(database_path: str = None, api_key: str = None) -> Chroma:
    """Returns a thread-safe singleton Chroma instance, reusing connections across queries."""
    global _CACHED_CHROMA, _CACHED_EMBEDDINGS, _CACHED_DB_PATH, _CACHED_API_KEY
    if not database_path:
        database_path = str(Path(__file__).resolve().parent.parent / "chroma")
    if not api_key:
        api_key = get_api_key()

    with _CHROMA_LOCK:
        if (
            _CACHED_CHROMA is not None
            and _CACHED_DB_PATH == database_path
            and _CACHED_API_KEY == api_key
        ):
            return _CACHED_CHROMA

        embedding_model = os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")
        embeddings = GoogleGenerativeAIEmbeddings(
            model=embedding_model,
            google_api_key=api_key,
        )
        db = Chroma(
            persist_directory=database_path,
            embedding_function=embeddings,
        )
        _CACHED_EMBEDDINGS = embeddings
        _CACHED_CHROMA = db
        _CACHED_DB_PATH = database_path
        _CACHED_API_KEY = api_key
        return db


def get_api_key() -> str:
    key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    return key.strip() if key else ""


def estimate_tokens(text: str) -> int:
    """Approximate token count (~4 characters per token for English)."""
    return max(1, len(text) // 4) if text else 0


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
- ALWAYS identify and refer to candidates by their REAL full human name (e.g. **Aaryan Palve**, **Piyush Choudhari**, **Rushikesh Kulkarni**), NOT as "Candidate Resume_1.pdf", "Candidate 1", or by their filename.
- Highlight specific strengths, matched skills, gaps, or flags where relevant.
- Format your response clearly using markdown headings, bullet points, and bold candidate names.
- Keep your analysis concise, structured, and actionable (around 200-350 words).
- If no candidates match a specific criterion, state that objectively.
"""


def prepare_rag_context(
    job_description: str,
    question: str,
    database_path: str = None,
    candidate_filter: Optional[str] = None
) -> Tuple[Optional[str], Optional[str], QueryMetrics, float, str, Optional[str]]:
    """
    Common RAG preparation: retrieval, candidate filtering, context diversity filtering, and prompt creation.
    Returns: (context_text, prompt, metrics, e2e_start, api_key, error_message)
    """
    query_id = str(uuid.uuid4())[:8]
    metrics = QueryMetrics(
        query_id=query_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        question=question[:300],
    )
    e2e_start = time.perf_counter()

    api_key = get_api_key()
    if not api_key or "your_gemini_api_key_here" in api_key.lower():
        metrics.status = "error"
        metrics.error_message = "Gemini API key missing"
        metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
        metrics_store.log_query(metrics)
        return (
            None,
            None,
            metrics,
            e2e_start,
            "",
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
        return (
            None,
            None,
            metrics,
            e2e_start,
            api_key,
            "⚠️ **No resumes indexed yet.** Please upload candidate resumes and a job description first."
        )

    try:
        # ── 1. Embedding Model Setup (Cached Singleton) ──
        embed_start = time.perf_counter()
        db = get_chroma_store(database_path=database_path, api_key=api_key)
        metrics.embedding_latency_ms = round((time.perf_counter() - embed_start) * 1000, 2)

        all_ids = db.get(include=[])
        total_docs = len(all_ids.get("ids", []))
        if total_docs == 0:
            metrics.status = "error"
            metrics.error_message = "Vector database contains zero indexed chunks"
            metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
            metrics_store.log_query(metrics)
            return (
                None,
                None,
                metrics,
                e2e_start,
                api_key,
                "⚠️ **Resume database is empty.** Please upload candidate resumes in PDF format before querying."
            )

        # ── 2. Vector Retrieval (Diverse Multi-Candidate or Targeted Candidate) ──
        retrieval_start = time.perf_counter()
        filter_term = candidate_filter.strip() if candidate_filter else ""
        search_query = f"{filter_term} {question} {job_description[:400]}".strip()
        fetch_k = min(total_docs, 24)
        target_k = min(total_docs, 10)

        raw_results = db.similarity_search_with_score(search_query, k=fetch_k)
        metrics.retrieval_latency_ms = round((time.perf_counter() - retrieval_start) * 1000, 2)

        if not raw_results:
            metrics.status = "error"
            metrics.error_message = "No matching chunks found"
            metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
            metrics_store.log_query(metrics)
            return (
                None,
                None,
                metrics,
                e2e_start,
                api_key,
                "No matching resume information could be retrieved for this query."
            )

        # Filter and prioritize chunks
        q_lower = question.lower()
        target_lower = filter_term.lower()
        per_source_counts = {}
        results = []
        overflow = []
        for doc, score in raw_results:
            src_name = Path(doc.metadata.get("source", "unknown")).name
            is_target = target_lower and (target_lower in src_name.lower())
            cap = 6 if is_target else (4 if src_name.lower() in q_lower else 2)
            count = per_source_counts.get(src_name, 0)
            if is_target:
                results.insert(0, (doc, score))
                per_source_counts[src_name] = count + 1
            elif count < cap:
                results.append((doc, score))
                per_source_counts[src_name] = count + 1
            else:
                overflow.append((doc, score))
            if len(results) >= target_k:
                break

        if len(results) < target_k and overflow:
            results.extend(overflow[: target_k - len(results)])

        # Lookup candidate real names from SQLite database
        filename_to_cand = {}
        try:
            from database import db
            with db._connect() as conn:
                rows = conn.execute("SELECT filename, name, fit_score FROM candidates").fetchall()
                for r in rows:
                    if r["filename"] and r["name"]:
                        filename_to_cand[r["filename"].lower()] = dict(r)
        except Exception as db_err:
            logging.warning(f"Could not load candidate names for RAG context: {db_err}")

        # Compute retrieval quality metrics
        scores = [float(score) for _, score in results]
        unique_files = set()
        context_blocks = []
        for doc, _ in results:
            src = doc.metadata.get("source", "")
            src_name = Path(src).name if src else "unknown"
            if src:
                unique_files.add(src_name)
            
            c_info = filename_to_cand.get(src_name.lower())
            if c_info and c_info.get("name") and c_info["name"].lower() not in ("candidate", "candidat", "resume"):
                cand_header = f"[Candidate Name: {c_info['name']} (File: {src_name})]"
            else:
                cand_header = f"[Candidate File: {src_name}]"
            context_blocks.append(f"{cand_header}\n{doc.page_content}")

        metrics.chunks_retrieved = len(results)
        metrics.avg_similarity_score = round(sum(scores) / len(scores), 4)
        metrics.min_similarity_score = round(min(scores), 4)
        metrics.max_similarity_score = round(max(scores), 4)
        metrics.unique_sources = len(unique_files)

        context_text = "\n\n---\n\n".join(context_blocks)
        metrics.context_length_chars = len(context_text)

        # ── 3. Prompt Assembly ──
        prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
        final_question = question
        if filter_term:
            final_question = f"[Focus Candidate: {filter_term}]\n{question}"

        prompt = prompt_template.format(
            job_description=job_description if job_description.strip() else "General Technical Screening",
            context=context_text,
            question=final_question,
        )
        metrics.estimated_input_tokens = estimate_tokens(prompt)

        return context_text, prompt, metrics, e2e_start, api_key, None

    except Exception as e:
        metrics.status = "error"
        metrics.error_message = str(e)[:250]
        metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
        metrics_store.log_query(metrics)
        logging.error(f"Error in prepare_rag_context: {e}", exc_info=True)
        return None, None, metrics, e2e_start, api_key, f"❌ **An error occurred while preparing context:** {str(e)}"


def query_rag(job_description: str, question: str, database_path: str = None, candidate_filter: Optional[str] = None) -> str:
    """
    Queries the RAG pipeline using ChromaDB context and Gemini Flash,
    fully instrumented with AIOps metrics collection and async auto-eval.
    """
    context_text, prompt, metrics, e2e_start, api_key, error_msg = prepare_rag_context(
        job_description=job_description,
        question=question,
        database_path=database_path,
        candidate_filter=candidate_filter,
    )
    if error_msg:
        return error_msg

    try:
        # ── 4. LLM Generation ──
        llm_start = time.perf_counter()
        env_chat_model = os.getenv("GEMINI_CHAT_MODEL", "").strip()
        candidate_models = list(dict.fromkeys(
            ([env_chat_model] if env_chat_model else []) + [
                "gemini-3.5-flash-lite",
                "gemini-3.8-flash",
                "gemini-3.5-flash",
                "gemini-flash-latest",
            ]
        ))
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
                    max_retries=2,
                    timeout=25,
                )
                response = model.invoke(prompt)
                model_used = m_name
                break
            except Exception as model_err:
                last_error = model_err
                fallback_count += 1
                logging.warning(f"[AIOps] Model {m_name} failed: {model_err}, trying fallback...")
                if "503" in str(model_err) or "UNAVAILABLE" in str(model_err):
                    time.sleep(1.0)

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

        metrics.estimated_cost_usd = round(
            (metrics.estimated_input_tokens * 0.000000075) + 
            (metrics.estimated_output_tokens * 0.0000003), 6
        )

        metrics_store.log_query(metrics)

        # ── 5. Trigger Async Auto-Evaluation ──
        evaluate_async(
            query_id=metrics.query_id,
            question=question,
            context=context_text,
            answer=answer_text,
            api_key=api_key,
            callback=lambda qid, scores: metrics_store.update_evaluation(qid, scores),
        )

        return answer_text

    except Exception as e:
        metrics.status = "error"
        metrics.error_message = str(e)[:250]
        metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
        metrics_store.log_query(metrics)
        logging.error(f"Error in query_rag: {e}", exc_info=True)
        err_str = str(e)
        if "503" in err_str or "UNAVAILABLE" in err_str:
            return (
                "⚠️ **Gemini API is temporarily overloaded (`503 UNAVAILABLE`).** "
                "All fallback models are currently experiencing high demand. Please retry in a few seconds."
            )
        return f"❌ **An error occurred while analyzing resumes:** {err_str}"


def stream_rag(job_description: str, question: str, database_path: str = None, candidate_filter: Optional[str] = None):
    """
    Generator that streams LLM tokens over Server-Sent Events (SSE).
    Yields format: 'data: {...}\\n\\n'
    """
    import json

    context_text, prompt, metrics, e2e_start, api_key, error_msg = prepare_rag_context(
        job_description=job_description,
        question=question,
        database_path=database_path,
        candidate_filter=candidate_filter,
    )
    if error_msg:
        yield f"data: {json.dumps({'error': error_msg})}\n\n"
        return

    llm_start = time.perf_counter()
    env_chat_model = os.getenv("GEMINI_CHAT_MODEL", "").strip()
    candidate_models = list(dict.fromkeys(
        ([env_chat_model] if env_chat_model else []) + [
            "gemini-3.5-flash-lite",
            "gemini-3.8-flash",
            "gemini-3.5-flash",
            "gemini-flash-latest",
        ]
    ))

    full_answer_parts = []
    streaming_succeeded = False
    model_used = ""
    fallback_count = 0
    last_error = None

    for m_name in candidate_models:
        try:
            model = ChatGoogleGenerativeAI(
                model=m_name,
                google_api_key=api_key,
                max_output_tokens=1024,
                max_retries=2,
                timeout=25,
            )
            for chunk in model.stream(prompt):
                raw_chunk = chunk.content if hasattr(chunk, "content") else str(chunk)
                if isinstance(raw_chunk, list):
                    chunk_text = "".join([
                        item.get("text", "") if isinstance(item, dict) else str(item)
                        for item in raw_chunk
                    ])
                else:
                    chunk_text = str(raw_chunk)

                if chunk_text:
                    full_answer_parts.append(chunk_text)
                    yield f"data: {json.dumps({'token': chunk_text})}\n\n"

            streaming_succeeded = True
            model_used = m_name
            break
        except Exception as model_err:
            last_error = model_err
            fallback_count += 1
            logging.warning(f"[AIOps] Stream fallback from {m_name}: {model_err}")
            if "503" in str(model_err) or "UNAVAILABLE" in str(model_err):
                time.sleep(1.0)

    metrics.llm_latency_ms = round((time.perf_counter() - llm_start) * 1000, 2)
    metrics.model_used = model_used
    metrics.model_fallback_count = fallback_count

    if not streaming_succeeded:
        err_msg = str(last_error)
        metrics.status = "error"
        metrics.error_message = err_msg[:200]
        metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
        metrics_store.log_query(metrics)
        yield f"data: {json.dumps({'error': f'Streaming failed: {err_msg}'})}\n\n"
        return

    full_answer = "".join(full_answer_parts).strip()
    metrics.response_length_chars = len(full_answer)
    metrics.estimated_output_tokens = estimate_tokens(full_answer)
    metrics.total_e2e_latency_ms = round((time.perf_counter() - e2e_start) * 1000, 2)
    metrics.status = "success"
    metrics.estimated_cost_usd = round(
        (metrics.estimated_input_tokens * 0.000000075) + 
        (metrics.estimated_output_tokens * 0.0000003), 6
    )

    metrics_store.log_query(metrics)

    # Trigger Async Evaluation
    evaluate_async(
        query_id=metrics.query_id,
        question=question,
        context=context_text,
        answer=full_answer,
        api_key=api_key,
        callback=lambda qid, scores: metrics_store.update_evaluation(qid, scores),
    )

    yield f"data: {json.dumps({'done': True, 'query_id': metrics.query_id, 'answer': full_answer})}\n\n"
