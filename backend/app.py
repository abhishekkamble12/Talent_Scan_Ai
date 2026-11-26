import os
import re
import sys
import logging
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from utils import query_rag, get_api_key
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
def load_sample_data():
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
):
    """Uploads job description and resumes as part of a multi-part form-data request."""
    try:
        jd_text = job_description.strip()
        if not resumes or not resumes[0].filename:
            return JSONResponse(status_code=400, content={"error": "Please provide at least one PDF resume."})

        if not jd_text:
            return JSONResponse(status_code=400, content={"error": "Job description is required."})

        saved_files = []
        for file in resumes:
            if file and file.filename and allowed_file(file.filename):
                filename = sanitize_filename(file.filename)
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

        return {
            "message": f"Successfully ingested {len(saved_files)} resumes and indexed content.",
            "saved_files": saved_files,
            "pipeline_stats": pipeline_stats,
        }

    except Exception as e:
        logging.error(f"Error in upload_resumes: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Upload processing failed: {str(e)}"})


@app.post("/api/reset")
def reset_uploads():
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
        )

        return {"answer": response}

    except Exception as e:
        logging.error(f"Error in /api/predict: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"An error occurred while processing: {str(e)}"})


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
