import os
import re
import sys
import time
import logging
import shutil
from collections import defaultdict
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, Query, UploadFile, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from utils import query_rag, stream_rag, get_api_key, invalidate_chroma_cache
from rag_pipeline import RAGPipeline
from aiops_metrics import metrics_store

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

app = FastAPI(
    title="TalentScan AI API",
    description="RAG-powered resume screening and AIOps observability API",
    version="2.0.0",
)

# ── Environment-Driven CORS ──
raw_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
if raw_origins:
    allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
else:
    allowed_origins = ["*", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://localhost:5000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-Memory Rate Limiting for Prediction Endpoints ──
_RATE_LIMIT_BUCKET = defaultdict(list)
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/predict"):
            client_ip = request.client.host if request.client else "unknown"
            now = time.time()
            window_start = now - 60
            _RATE_LIMIT_BUCKET[client_ip] = [ts for ts in _RATE_LIMIT_BUCKET[client_ip] if ts > window_start]
            if len(_RATE_LIMIT_BUCKET[client_ip]) >= RATE_LIMIT_PER_MINUTE:
                return JSONResponse(
                    status_code=429,
                    content={"error": f"Rate limit exceeded ({RATE_LIMIT_PER_MINUTE} requests/min). Please try again shortly."}
                )
            _RATE_LIMIT_BUCKET[client_ip].append(now)
        return await call_next(request)

app.add_middleware(RateLimitMiddleware)

# ── Optional Token Auth Dependency ──
def verify_token_optional(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
):
    """If APP_ACCESS_TOKEN is set in .env, requires Bearer or X-API-Key authentication."""
    expected_token = os.getenv("APP_ACCESS_TOKEN", "").strip()
    if not expected_token:
        return True

    provided = None
    if authorization and authorization.lower().startswith("bearer "):
        provided = authorization[7:].strip()
    elif x_api_key:
        provided = x_api_key.strip()

    if provided != expected_token:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing access token.")
    return True

MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(15 * 1024 * 1024))) # 15MB default
UPLOAD_FOLDER = PROJECT_ROOT / "uploads"
DATABASE_PATH = PROJECT_ROOT / "chroma"
SAMPLE_PDFS_DIR = PROJECT_ROOT / "bot" / "data" / "pdfs"

jd_path = UPLOAD_FOLDER / "jd"
pdfs_path = UPLOAD_FOLDER / "pdfs"
jd_path.mkdir(parents=True, exist_ok=True)
pdfs_path.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf"}

DEFAULT_SAMPLE_JD = """Full Stack Software Engineer (React & Python)

About the Role:
We need a Full Stack Engineer to build and maintain user-facing web applications. You will work across the React client and Python backend, shipping production features alongside our product and data teams.

Key Responsibilities:
- Build accessible, high-performance web interfaces with React, TypeScript, and TailwindCSS.
- Build and maintain REST APIs with Python (FastAPI, Flask, or Django).
- Manage relational and vector databases (PostgreSQL, ChromaDB).
- Integrate LLM workflows, Retrieval-Augmented Generation (RAG) pipelines, and document search.
- Write unit and integration tests for critical user flows and API endpoints.

Qualifications:
- 2+ years of full-stack software development experience.
- Hands-on experience with JavaScript/TypeScript, React, and semantic HTML/CSS.
- Experience building APIs and database schemas in Python.
- Practical experience with Git, Docker, and CI/CD pipelines (AWS or GCP).
- Experience working with external APIs and asynchronous tasks.
"""


class PredictRequest(BaseModel):
    question: str = ""
    job_description: Optional[str] = ""
    candidate_filter: Optional[str] = None


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def sanitize_filename(filename: str) -> str:
    base = Path(filename).name
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._")
    return cleaned or "resume.pdf"


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "resume-screener-api"}


@app.get("/api/status")
def get_status():
    """Returns the current configuration, uploaded resumes count, and JD status."""
    existing_pdfs = [f for f in os.listdir(pdfs_path) if f.lower().endswith(".pdf")] if pdfs_path.exists() else []
    jd_file = jd_path / "job_description.txt"
    has_jd = jd_file.exists() and jd_file.stat().st_size > 5
    jd_content = ""
    if has_jd:
        try:
            with open(jd_file, "r", encoding="utf-8") as f:
                jd_content = f.read()
        except Exception:
            pass

    api_key = get_api_key()
    has_api_key = bool(api_key and "your_gemini_api_key_here" not in api_key.lower())

    return {
        "resumes_count": len(existing_pdfs),
        "resumes": existing_pdfs,
        "has_job_description": has_jd,
        "job_description_snippet": (jd_content[:300] + "...") if len(jd_content) > 300 else jd_content,
        "job_description_full": jd_content,
        "api_key_configured": has_api_key,
    }


@app.post("/api/load-sample")
def load_sample_data(_auth: bool = Depends(verify_token_optional)):
    """Pre-loads bundled sample resumes and a standard Software Engineer JD for instant 1-click demos."""
    try:
        if not SAMPLE_PDFS_DIR.exists():
            return JSONResponse(status_code=404, content={"error": "Sample resumes directory not found."})

        sample_files = [f for f in os.listdir(SAMPLE_PDFS_DIR) if f.lower().endswith(".pdf")]
        if not sample_files:
            return JSONResponse(status_code=404, content={"error": "No sample PDFs found in bot/data/pdfs."})

        copied_count = 0
        for fname in sample_files:
            src = SAMPLE_PDFS_DIR / fname
            dst = pdfs_path / fname
            shutil.copy2(src, dst)
            copied_count += 1

        with open(jd_path / "job_description.txt", "w", encoding="utf-8") as f:
            f.write(DEFAULT_SAMPLE_JD)

        pipeline = RAGPipeline(
            document_type="pdf",
            data_path=str(pdfs_path),
            database_path=str(DATABASE_PATH),
        )
        stats = pipeline.run_pipeline()
        invalidate_chroma_cache()

        return {
            "message": f"Successfully loaded {copied_count} demo resumes and sample job description!",
            "resumes_loaded": sample_files,
            "job_description": DEFAULT_SAMPLE_JD,
            "pipeline_stats": stats,
        }

    except Exception as e:
        logging.error(f"Error loading sample data: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Failed to load sample data: {str(e)}"})


@app.post("/api/upload")
def upload_resumes(
    job_description: str = Form(""),
    resumes: List[UploadFile] = File(default=[]),
    _auth: bool = Depends(verify_token_optional),
):
    """Uploads job description and resumes as part of a multi-part form-data request."""
    try:
        jd_text = job_description.strip()
        if not jd_text:
            return JSONResponse(status_code=400, content={"error": "Job description is required."})

        has_new_files = bool(resumes and any(f and f.filename for f in resumes))
        existing_pdfs = [f for f in os.listdir(pdfs_path) if f.lower().endswith(".pdf")] if pdfs_path.exists() else []

        if not has_new_files:
            if not existing_pdfs:
                return JSONResponse(status_code=400, content={"error": "Please provide at least one PDF resume."})
            with open(jd_path / "job_description.txt", "w", encoding="utf-8") as jd_file:
                jd_file.write(jd_text)
            return {
                "message": f"Updated job description for {len(existing_pdfs)} indexed resumes.",
                "saved_files": [],
                "pipeline_stats": None,
            }

        saved_files = []
        for file in resumes:
            if file and file.filename and allowed_file(file.filename):
                filename = sanitize_filename(file.filename)

                # 1. Magic bytes check: must start with %PDF-
                magic = file.file.read(5)
                file.file.seek(0)
                if magic != b"%PDF-":
                    return JSONResponse(
                        status_code=400,
                        content={"error": f"File '{file.filename}' is not a valid PDF (%PDF- header missing)."}
                    )

                # 2. File size check
                file.file.seek(0, os.SEEK_END)
                size = file.file.tell()
                file.file.seek(0)
                if size > MAX_FILE_SIZE_BYTES:
                    max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
                    return JSONResponse(
                        status_code=400,
                        content={"error": f"File '{file.filename}' exceeds maximum allowed size of {max_mb}MB."}
                    )

                target_file = pdfs_path / filename
                with open(target_file, "wb") as out:
                    shutil.copyfileobj(file.file, out)
                saved_files.append(filename)

        if not saved_files:
            return JSONResponse(status_code=400, content={"error": "No valid PDF files were provided."})

        with open(jd_path / "job_description.txt", "w", encoding="utf-8") as jd_file:
            jd_file.write(jd_text)

        rag_pipeline = RAGPipeline(
            document_type="pdf",
            data_path=str(pdfs_path),
            database_path=str(DATABASE_PATH),
        )
        pipeline_stats = rag_pipeline.run_pipeline()
        invalidate_chroma_cache()

        return {
            "message": f"Successfully ingested {len(saved_files)} resumes and indexed content.",
            "saved_files": saved_files,
            "pipeline_stats": pipeline_stats,
        }

    except Exception as e:
        logging.error(f"Error in upload_resumes: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Upload processing failed: {str(e)}"})


@app.post("/api/reset")
def reset_uploads(_auth: bool = Depends(verify_token_optional)):
    """Resets the uploaded files and clears the ChromaDB vector database."""
    try:
        for folder in [jd_path, pdfs_path]:
            if folder.exists():
                for filename in os.listdir(folder):
                    file_path = folder / filename
                    if file_path.is_file():
                        file_path.unlink()

        if DATABASE_PATH.exists():
            shutil.rmtree(DATABASE_PATH)
        invalidate_chroma_cache()

        return {"message": "All uploads and vector databases have been reset."}

    except Exception as e:
        logging.error(f"Error resetting uploads: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to reset uploads."})


@app.post("/api/predict")
def predict(payload: PredictRequest):
    """Endpoint to query the RAG pipeline for answers based on job descriptions and resumes."""
    try:
        question = payload.question.strip()
        if not question:
            return JSONResponse(status_code=400, content={"error": "A question is required."})

        job_description = (payload.job_description or "").strip()
        jd_file = jd_path / "job_description.txt"

        if not job_description and jd_file.exists():
            with open(jd_file, "r", encoding="utf-8") as f:
                job_description = f.read()

        response = query_rag(
            job_description=job_description,
            question=question,
            database_path=str(DATABASE_PATH),
            candidate_filter=payload.candidate_filter,
        )

        return {"answer": response}

    except Exception as e:
        logging.error(f"Error in /api/predict: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"An error occurred while processing: {str(e)}"})


@app.post("/api/predict/stream")
def predict_stream(payload: PredictRequest):
    """Real-time SSE streaming endpoint for RAG question answering."""
    try:
        question = payload.question.strip()
        if not question:
            return JSONResponse(status_code=400, content={"error": "A question is required."})

        job_description = (payload.job_description or "").strip()
        jd_file = jd_path / "job_description.txt"

        if not job_description and jd_file.exists():
            with open(jd_file, "r", encoding="utf-8") as f:
                job_description = f.read()

        return StreamingResponse(
            stream_rag(
                job_description=job_description,
                question=question,
                database_path=str(DATABASE_PATH),
                candidate_filter=payload.candidate_filter,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        logging.error(f"Error in /api/predict/stream: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Streaming error: {str(e)}"})


@app.get("/api/candidates")
def get_candidates():
    """Returns list of structured candidate profiles extracted from resumes."""
    try:
        profiles = metrics_store.get_all_candidate_profiles()
        existing_pdfs = [f for f in os.listdir(pdfs_path) if f.lower().endswith(".pdf")] if pdfs_path.exists() else []

        # If profiles are missing for any existing PDFs, extract and backfill
        existing_filenames = {p.get("filename") for p in profiles}
        missing = [f for f in existing_pdfs if f not in existing_filenames]
        if missing:
            from candidate_extractor import extract_profile_from_pages
            from langchain_community.document_loaders import PyPDFLoader
            for fname in missing:
                fpath = pdfs_path / fname
                try:
                    loader = PyPDFLoader(str(fpath))
                    pages = [p.page_content for p in loader.load()]
                    prof = extract_profile_from_pages(fname, pages)
                    metrics_store.upsert_candidate_profile(
                        filename=prof["filename"],
                        candidate_name=prof["candidate_name"],
                        top_skills=prof["top_skills"],
                        estimated_years_exp=prof["estimated_years_exp"],
                        education=prof["education"],
                        summary=prof["summary"],
                    )
                except Exception as f_err:
                    logging.warning(f"Failed extracting profile for {fname}: {f_err}")
            profiles = metrics_store.get_all_candidate_profiles()

        return {"candidates": profiles, "total": len(profiles)}
    except Exception as e:
        logging.error(f"Error fetching candidates: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.delete("/api/candidates/{filename}")
def delete_candidate(filename: str, _auth: bool = Depends(verify_token_optional)):
    """Deletes a specific candidate resume, removes from Chroma vector store, and clears profile."""
    try:
        sanitized = sanitize_filename(filename)
        target_file = pdfs_path / sanitized
        if target_file.exists():
            target_file.unlink()

        metrics_store.delete_candidate_profile(sanitized)

        # Invalidate Chroma cache and re-index remaining
        invalidate_chroma_cache()
        if pdfs_path.exists() and any(f.endswith(".pdf") for f in os.listdir(pdfs_path)):
            rag_pipeline = RAGPipeline(
                document_type="pdf",
                data_path=str(pdfs_path),
                database_path=str(DATABASE_PATH),
            )
            rag_pipeline.run_pipeline()
        elif DATABASE_PATH.exists():
            shutil.rmtree(DATABASE_PATH)

        return {"message": f"Candidate '{sanitized}' deleted successfully."}
    except Exception as e:
        logging.error(f"Error deleting candidate {filename}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


# ─────────────────────────────────────────────────────────────
# AIOps Observability, Evaluation & Metrics API
# ─────────────────────────────────────────────────────────────

@app.get("/api/aiops/dashboard")
def aiops_dashboard(last_n: int = Query(default=100, ge=1)):
    """Returns high-level aggregate summary of RAG performance, latency, retrieval quality, LLM evaluations, and cost metrics."""
    try:
        return metrics_store.get_summary(last_n=last_n)
    except Exception as e:
        logging.error(f"Error in /api/aiops/dashboard: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/aiops/queries")
def aiops_recent_queries(limit: int = Query(default=20, ge=1)):
    """Returns granular per-query metrics history."""
    try:
        queries = metrics_store.get_recent_queries(limit=limit)
        return {"queries": queries}
    except Exception as e:
        logging.error(f"Error in /api/aiops/queries: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/aiops/latency")
def aiops_latency_timeseries(limit: int = Query(default=50, ge=1)):
    """Returns time-series latency breakdown (Embedding, Retrieval, LLM)."""
    try:
        data = metrics_store.get_latency_timeseries(limit=limit)
        return {"timeseries": data}
    except Exception as e:
        logging.error(f"Error in /api/aiops/latency: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/aiops/evaluations")
def aiops_evaluation_timeseries(limit: int = Query(default=50, ge=1)):
    """Returns time-series evaluation scores across relevance, groundedness, coherence, etc."""
    try:
        data = metrics_store.get_evaluation_timeseries(limit=limit)
        return {"timeseries": data}
    except Exception as e:
        logging.error(f"Error in /api/aiops/evaluations: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)
