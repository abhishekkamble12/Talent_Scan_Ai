import os
import re
import sys
import time
import logging
import shutil
import io
import csv
from collections import defaultdict
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, File, Form, Query, UploadFile, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
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
from database import db
from schemas import (
    JobCreate,
    JobUpdate,
    RequirementsUpdate,
    CandidateStatusUpdate,
    CompareRequest,
)
from job_service import create_job_with_requirements
from scoring_service import (
    score_candidate_against_job,
    screen_all_candidates_generator,
)
from candidate_extractor import extract_profile_from_pages
from upskilling_service import generate_candidate_upskilling_plan
from feedback_reranker import apply_smart_rerank

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

app = FastAPI(
    title="TalentScan AI API",
    description="Job-centric AI candidate screening, auditable scoring, and AIOps observability API",
    version="2.1.0",
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
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))

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

# Mount static files to serve uploaded PDFs
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_FOLDER)), name="uploads")

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
    job_id: Optional[str] = None


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def sanitize_filename(filename: str) -> str:
    base = Path(filename).name
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._")
    return cleaned or "resume.pdf"


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "talentscan-ai-api", "version": "2.1.0"}


@app.get("/api/status")
def get_status():
    """Returns the current configuration, uploaded resumes count, active jobs, and status."""
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
    jobs = db.list_jobs()

    return {
        "resumes_count": len(existing_pdfs),
        "resumes": existing_pdfs,
        "has_job_description": has_jd or len(jobs) > 0,
        "job_description_snippet": (jd_content[:300] + "...") if len(jd_content) > 300 else jd_content,
        "job_description_full": jd_content,
        "api_key_configured": has_api_key,
        "jobs_count": len(jobs),
        "active_job": jobs[0] if jobs else None,
    }


# ─────────────────────────────────────────────────────────────
# 1. Job Management & Requirements Endpoints
# ─────────────────────────────────────────────────────────────

@app.post("/api/jobs")
def create_job(payload: JobCreate, _auth: bool = Depends(verify_token_optional)):
    """Creates a new Job Workspace and extracts editable requirement chips."""
    try:
        desc = payload.description.strip()
        if not desc:
            return JSONResponse(status_code=400, content={"error": "Job description is required."})

        job = create_job_with_requirements(description=desc, title=payload.title)

        # Also sync to legacy job_description.txt so RAG querying remains backward compatible
        with open(jd_path / "job_description.txt", "w", encoding="utf-8") as f:
            f.write(desc)

        return job
    except Exception as e:
        logging.error(f"Error creating job: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Failed to create job: {str(e)}"})


@app.get("/api/jobs")
def list_jobs():
    """Lists all active job workspaces."""
    try:
        jobs = db.list_jobs()
        return {"jobs": jobs, "total": len(jobs)}
    except Exception as e:
        logging.error(f"Error listing jobs: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    """Retrieves full details of a specific job workspace including requirements."""
    try:
        job = db.get_job(job_id)
        if not job:
            return JSONResponse(status_code=404, content={"error": f"Job {job_id} not found."})
        return job
    except Exception as e:
        logging.error(f"Error getting job {job_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.patch("/api/jobs/{job_id}")
def update_job(job_id: str, payload: JobUpdate, _auth: bool = Depends(verify_token_optional)):
    """Updates job title or description."""
    try:
        updated = db.update_job(job_id, title=payload.title, description=payload.description)
        if not updated:
            return JSONResponse(status_code=404, content={"error": f"Job {job_id} not found."})
        return updated
    except Exception as e:
        logging.error(f"Error updating job {job_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.patch("/api/jobs/{job_id}/requirements")
def update_requirements(job_id: str, payload: RequirementsUpdate, _auth: bool = Depends(verify_token_optional)):
    """Edits, reorders, or updates categories (must-have / nice-to-have) for job requirement chips."""
    try:
        job = db.get_job(job_id)
        if not job:
            return JSONResponse(status_code=404, content={"error": f"Job {job_id} not found."})

        reqs_dicts = [r.model_dump() if hasattr(r, "model_dump") else r.dict() for r in payload.requirements]
        updated_reqs = db.set_requirements(job_id, reqs_dicts)
        return {"job_id": job_id, "requirements": updated_reqs}
    except Exception as e:
        logging.error(f"Error updating requirements for job {job_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str, _auth: bool = Depends(verify_token_optional)):
    """Deletes a job and all its candidates, requirements, and scores."""
    try:
        success = db.delete_job(job_id)
        if not success:
            return JSONResponse(status_code=404, content={"error": f"Job {job_id} not found."})
        return {"message": f"Job {job_id} deleted successfully."}
    except Exception as e:
        logging.error(f"Error deleting job {job_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


# ─────────────────────────────────────────────────────────────
# 2. Bulk Upload & Candidate Screening Endpoints
# ─────────────────────────────────────────────────────────────

@app.post("/api/jobs/{job_id}/candidates")
async def upload_job_candidates(
    job_id: str,
    resumes: List[UploadFile] = File(...),
    source: Optional[str] = Form("direct_upload"),
    _auth: bool = Depends(verify_token_optional)
):
    """Bulk uploads PDF resumes directly into a specific job workspace."""
    try:
        job = db.get_job(job_id)
        if not job:
            return JSONResponse(status_code=404, content={"error": f"Job {job_id} not found."})

        if not resumes:
            return JSONResponse(status_code=400, content={"error": "Please provide at least one PDF resume."})

        from langchain_community.document_loaders import PyPDFLoader
        import uuid

        uploaded_records = []
        errors = []

        for file in resumes:
            if not file or not file.filename:
                continue

            if not allowed_file(file.filename):
                errors.append(f"'{file.filename}' is not a PDF file.")
                continue

            # Verify magic bytes
            magic = await file.read(5)
            await file.seek(0)
            if magic != b"%PDF-":
                errors.append(f"'{file.filename}' is not a valid PDF (%PDF- header missing).")
                continue

            # Verify size
            await file.seek(0, os.SEEK_END)
            size = file.file.tell()
            await file.seek(0)
            if size > MAX_FILE_SIZE_BYTES:
                errors.append(f"'{file.filename}' exceeds {MAX_FILE_SIZE_BYTES // (1024*1024)}MB size limit.")
                continue

            filename = sanitize_filename(file.filename)
            target_path = pdfs_path / filename

            with open(target_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Extract structured profile metadata
            try:
                loader = PyPDFLoader(str(target_path))
                pages = [p.page_content for p in loader.load()]
                profile = extract_profile_from_pages(filename, pages)
            except Exception as parse_err:
                logging.warning(f"Failed extracting profile for {filename}: {parse_err}")
                profile = {
                    "filename": filename,
                    "candidate_name": Path(filename).stem.replace("_", " ").title(),
                    "top_skills": "",
                    "estimated_years_exp": 2.0,
                    "education": "PDF Document",
                    "summary": ""
                }

            # Insert into database with tracked source
            cand_id = str(uuid.uuid4())
            new_cand = db.add_candidate({
                "id": cand_id,
                "job_id": job_id,
                "filename": filename,
                "name": profile.get("candidate_name") or filename,
                "skills": profile.get("top_skills", ""),
                "education": profile.get("education", ""),
                "years_exp": profile.get("estimated_years_exp", 2.0),
                "summary": profile.get("summary", ""),
                "status": "new",
                "source": source or "direct_upload"
            })
            uploaded_records.append(new_cand)

        # Index new resumes into ChromaDB
        if uploaded_records:
            try:
                pipeline = RAGPipeline(
                    document_type="pdf",
                    data_path=str(pdfs_path),
                    database_path=str(DATABASE_PATH),
                )
                pipeline.run_pipeline()
                invalidate_chroma_cache()
            except Exception as rag_err:
                logging.warning(f"Notice during RAG indexing: {rag_err}")

        return {
            "message": f"Successfully uploaded {len(uploaded_records)} candidate resumes.",
            "uploaded": uploaded_records,
            "errors": errors
        }

    except Exception as e:
        logging.error(f"Error in upload_job_candidates: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Bulk upload failed: {str(e)}"})


@app.post("/api/jobs/{job_id}/screen")
def screen_job_candidates(job_id: str, _auth: bool = Depends(verify_token_optional)):
    """Triggers automated screening for all candidates in a job, streaming SSE progress."""
    try:
        job = db.get_job(job_id)
        if not job:
            return JSONResponse(status_code=404, content={"error": f"Job {job_id} not found."})

        return StreamingResponse(
            screen_all_candidates_generator(job_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    except Exception as e:
        logging.error(f"Error screening candidates for job {job_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/jobs/{job_id}/candidates")
def list_job_candidates(
    job_id: str,
    status: Optional[str] = Query(None),
    min_score: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query("fit_score")
):
    """
    Returns ranked candidate list with fit scores, must-haves met, and gap summaries.
    Supports ?sort=learned or ?sort=smart_rerank to apply recruiter feedback-weighted reranking.
    """
    try:
        candidates = db.list_candidates_for_job(
            job_id=job_id,
            status=status,
            min_score=min_score,
            search=search
        )

        smart_active = sort in ("learned", "smart_rerank")
        model_trained = False
        feedback_signal = ""

        if smart_active and candidates:
            rerank_res = apply_smart_rerank(candidates)
            candidates = rerank_res["candidates"]
            model_trained = rerank_res["model_trained"]
            feedback_signal = rerank_res["feedback_signal"]

        return {
            "candidates": candidates,
            "total": len(candidates),
            "smart_rerank_active": smart_active,
            "model_trained": model_trained,
            "feedback_signal": feedback_signal
        }
    except Exception as e:
        logging.error(f"Error listing candidates for job {job_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


# ─────────────────────────────────────────────────────────────
# 3. Candidate Detail, Decisioning & Evidence Endpoints
# ─────────────────────────────────────────────────────────────

@app.get("/api/candidates/{candidate_id}")
def get_candidate_detail(candidate_id: str):
    """Returns candidate detail with all per-requirement evidence quotes, page citations, and interview Qs."""
    try:
        cand = db.get_candidate(candidate_id)
        if not cand:
            return JSONResponse(status_code=404, content={"error": f"Candidate {candidate_id} not found."})

        # If not yet scored, attempt on-the-fly score
        if not cand.get("requirements") and cand.get("job_id"):
            try:
                cand = score_candidate_against_job(candidate_id, cand["job_id"])
            except Exception as s_err:
                logging.warning(f"Could not on-the-fly score candidate {candidate_id}: {s_err}")

        return cand
    except Exception as e:
        logging.error(f"Error fetching candidate {candidate_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.patch("/api/candidates/{candidate_id}")
def update_candidate_decision(
    candidate_id: str,
    payload: CandidateStatusUpdate,
    _auth: bool = Depends(verify_token_optional)
):
    """Updates candidate review status (shortlisted, rejected, maybe, new) and recruiter notes."""
    try:
        updated = db.update_candidate_status_notes(
            candidate_id=candidate_id,
            status=payload.status,
            notes=payload.notes
        )
        if not updated:
            return JSONResponse(status_code=404, content={"error": f"Candidate {candidate_id} not found."})
        return updated
    except Exception as e:
        logging.error(f"Error updating candidate {candidate_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


# ─────────────────────────────────────────────────────────────
# 3b. Shareable Match Explanation & Upskilling Endpoints
# ─────────────────────────────────────────────────────────────

@app.post("/api/candidates/{candidate_id}/share")
def create_share_link(candidate_id: str, _auth: bool = Depends(verify_token_optional)):
    """Generates a secure token for hiring managers to view a candidate match scorecard without login."""
    try:
        result = db.create_or_get_share_token(candidate_id)
        return result
    except Exception as e:
        logging.error(f"Error generating share link for {candidate_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.delete("/api/candidates/{candidate_id}/share")
def revoke_share_link(candidate_id: str, _auth: bool = Depends(verify_token_optional)):
    """Revokes a shareable link for a candidate."""
    try:
        success = db.disable_share_token(candidate_id)
        return {"revoked": success}
    except Exception as e:
        logging.error(f"Error revoking share link for {candidate_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/public/share/{token}")
def get_public_scorecard(token: str):
    """Public read-only candidate scorecard endpoint for hiring managers (no login required, notes omitted)."""
    try:
        card = db.get_candidate_by_share_token(token)
        if not card:
            return JSONResponse(status_code=404, content={"error": "Scorecard not found or link has expired."})
        return card
    except Exception as e:
        logging.error(f"Error loading public scorecard: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/candidates/{candidate_id}/upskilling")
def get_candidate_upskilling(candidate_id: str):
    """Returns tailored upskilling roadmap, recommended courses, and project blueprints for candidate gaps."""
    try:
        cand = db.get_candidate(candidate_id)
        if not cand:
            return JSONResponse(status_code=404, content={"error": f"Candidate {candidate_id} not found."})

        job_title = ""
        if cand.get("job_id"):
            job = db.get_job(cand["job_id"])
            if job:
                job_title = job["title"]

        plan = generate_candidate_upskilling_plan(cand, job_title=job_title)
        return plan
    except Exception as e:
        logging.error(f"Error generating upskilling plan for {candidate_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/candidate-self-check")
async def candidate_self_check(
    resume: UploadFile = File(...),
    job_id: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None)
):
    """
    Candidate-facing self-service check: uploads resume against an active job or custom JD,
    and returns fit score, evidence breakdown, and customized upskilling roadmap.
    """
    try:
        if not resume or not resume.filename:
            return JSONResponse(status_code=400, content={"error": "Please provide a resume PDF."})

        if not allowed_file(resume.filename):
            return JSONResponse(status_code=400, content={"error": "Only PDF resumes are supported."})

        # Resolve job or create ad-hoc temporary job
        target_job_id = job_id
        if not target_job_id:
            desc = (job_description or "").strip()
            if not desc:
                # Default to first active job if exists
                jobs = db.list_jobs()
                if jobs:
                    target_job_id = jobs[0]["id"]
                else:
                    target_job_id = create_job_with_requirements(DEFAULT_SAMPLE_JD, title="Full Stack Engineer")["id"]
            else:
                target_job_id = create_job_with_requirements(desc, title="Custom Job Opportunity")["id"]

        job = db.get_job(target_job_id)
        if not job:
            return JSONResponse(status_code=404, content={"error": "Job not found."})

        # Save resume file
        filename = sanitize_filename(f"selfcheck_{resume.filename}")
        target_path = pdfs_path / filename
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)

        from langchain_community.document_loaders import PyPDFLoader
        import uuid

        try:
            loader = PyPDFLoader(str(target_path))
            pages = [p.page_content for p in loader.load()]
            profile = extract_profile_from_pages(filename, pages)
        except Exception:
            profile = {
                "candidate_name": Path(filename).stem.replace("selfcheck_", "").replace("_", " ").title(),
                "top_skills": "",
                "estimated_years_exp": 2.0,
                "education": "PDF Document",
                "summary": ""
            }

        cand_id = str(uuid.uuid4())
        cand = db.add_candidate({
            "id": cand_id,
            "job_id": target_job_id,
            "filename": filename,
            "name": profile.get("candidate_name") or filename,
            "skills": profile.get("top_skills", ""),
            "education": profile.get("education", ""),
            "years_exp": profile.get("estimated_years_exp", 2.0),
            "summary": profile.get("summary", ""),
            "status": "new",
            "source": "candidate_self_check"
        })

        # Perform scoring
        scored_cand = score_candidate_against_job(cand_id, target_job_id)
        upskilling_plan = generate_candidate_upskilling_plan(scored_cand, job_title=job["title"])

        return {
            "candidate": scored_cand,
            "job_title": job["title"],
            "upskilling_plan": upskilling_plan
        }
    except Exception as e:
        logging.error(f"Error in candidate_self_check: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Self-check failed: {str(e)}"})


# ─────────────────────────────────────────────────────────────
# 3c. Job Posting Analytics Endpoint
# ─────────────────────────────────────────────────────────────

@app.get("/api/jobs/{job_id}/analytics")
def get_job_analytics_endpoint(job_id: str):
    """Returns funnel conversion, drop-off by stage, time-in-stage, and source quality metrics."""
    try:
        analytics = db.get_job_analytics(job_id)
        if "error" in analytics:
            return JSONResponse(status_code=404, content=analytics)
        return analytics
    except Exception as e:
        logging.error(f"Error getting analytics for job {job_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


# ─────────────────────────────────────────────────────────────
# 4. Comparison Matrix & Export Endpoints
# ─────────────────────────────────────────────────────────────

@app.post("/api/jobs/{job_id}/compare")
def compare_candidates(job_id: str, payload: CompareRequest):
    """Generates comparison matrix across 2-4 candidates against all job requirements."""
    try:
        if not payload.candidate_ids:
            return JSONResponse(status_code=400, content={"error": "Please provide candidate_ids to compare."})

        matrix = db.get_comparison_matrix(job_id, payload.candidate_ids)
        return matrix
    except Exception as e:
        logging.error(f"Error comparing candidates for job {job_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/jobs/{job_id}/export")
def export_job_report(job_id: str, format: str = Query("csv")):
    """Exports candidates and scores as a downloadable CSV report."""
    try:
        job = db.get_job(job_id)
        if not job:
            return JSONResponse(status_code=404, content={"error": f"Job {job_id} not found."})

        candidates = db.list_candidates_for_job(job_id)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Candidate Name", "Fit Score", "Status", "Must-Haves Met", "Gaps", "Experience (Yrs)", "Education", "Skills", "Filename", "Notes"])

        for c in candidates:
            must_ratio = f"{c.get('must_haves_met', 0)}/{c.get('must_haves_total', 0)}"
            writer.writerow([
                c.get("name") or c.get("filename"),
                c.get("fit_score", 0),
                c.get("status", "new").upper(),
                must_ratio,
                c.get("gaps", ""),
                c.get("years_exp", 0),
                c.get("education", ""),
                c.get("skills", ""),
                c.get("filename", ""),
                c.get("notes", "")
            ])

        csv_content = output.getvalue()
        output.close()

        safe_title = re.sub(r"[^A-Za-z0-9_-]", "_", job.get("title", "candidates"))
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="TalentScan_{safe_title}_Report.csv"'}
        )
    except Exception as e:
        logging.error(f"Error exporting report: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


# ─────────────────────────────────────────────────────────────
# 5. One-Click Demo Sample Seeder
# ─────────────────────────────────────────────────────────────

@app.post("/api/load-sample")
def load_sample_data(_auth: bool = Depends(verify_token_optional)):
    """Pre-loads 6 demo candidate resumes, creates a Software Engineer job, and auto-screens them."""
    try:
        import uuid
        from langchain_community.document_loaders import PyPDFLoader

        if not SAMPLE_PDFS_DIR.exists():
            return JSONResponse(status_code=404, content={"error": "Sample resumes directory not found."})

        sample_files = [f for f in os.listdir(SAMPLE_PDFS_DIR) if f.lower().endswith(".pdf")]
        if not sample_files:
            return JSONResponse(status_code=404, content={"error": "No sample PDFs found in bot/data/pdfs."})

        # Known candidate names mapping for bundled demo resumes
        SAMPLE_NAMES = {
            "Resume_1.pdf": "Aaryan Palve",
            "Resume_5.pdf": "Nidhish Wakodikar",
            "Resume_6.pdf": "Piyush Choudhari",
            "Resume_8.pdf": "Rushikesh Kulkarni",
            "Resume_9.pdf": "Yash Mhaskar",
            "Resume_10.pdf": "Uday Bhole",
        }

        # 1. Create or retrieve Default Sample Job
        existing_jobs = db.list_jobs()
        sample_job = next((j for j in existing_jobs if "Full Stack Software Engineer" in j.get("title", "")), None)

        if not sample_job:
            sample_job = create_job_with_requirements(
                description=DEFAULT_SAMPLE_JD,
                title="Full Stack Software Engineer (React & Python)"
            )
        job_id = sample_job["id"]

        # 2. Copy sample PDFs and register candidates
        copied_count = 0
        for fname in sample_files:
            src = SAMPLE_PDFS_DIR / fname
            dst = pdfs_path / fname
            shutil.copy2(src, dst)
            copied_count += 1

            # Check if candidate already exists in this job
            existing_cands = db.list_candidates_for_job(job_id)
            existing_match = next((c for c in existing_cands if c.get("filename") == fname), None)

            if not existing_match:
                try:
                    loader = PyPDFLoader(str(dst))
                    pages = [p.page_content for p in loader.load()]
                    profile = extract_profile_from_pages(fname, pages)
                except Exception:
                    profile = {
                        "filename": fname,
                        "candidate_name": SAMPLE_NAMES.get(fname, Path(fname).stem.replace("_", " ").title()),
                        "top_skills": "Python, React, FastAPI",
                        "estimated_years_exp": 3.0,
                        "education": "B.S. Computer Science",
                        "summary": ""
                    }

                cand_name = SAMPLE_NAMES.get(fname) or profile.get("candidate_name") or fname
                cand_id = str(uuid.uuid4())
                db.add_candidate({
                    "id": cand_id,
                    "job_id": job_id,
                    "filename": fname,
                    "name": cand_name,
                    "skills": profile.get("top_skills", ""),
                    "education": profile.get("education", ""),
                    "years_exp": profile.get("estimated_years_exp", 2.0),
                    "summary": profile.get("summary", ""),
                    "status": "new"
                })

        with open(jd_path / "job_description.txt", "w", encoding="utf-8") as f:
            f.write(DEFAULT_SAMPLE_JD)

        # 3. Index ChromaDB (with graceful fallback if API key quota exceeded)
        stats = {"status": "indexed"}
        try:
            pipeline = RAGPipeline(
                document_type="pdf",
                data_path=str(pdfs_path),
                database_path=str(DATABASE_PATH),
            )
            stats = pipeline.run_pipeline()
            invalidate_chroma_cache()
        except Exception as chroma_err:
            logging.warning(f"Notice during ChromaDB indexing: {chroma_err}")
            stats = {"status": "notice", "message": str(chroma_err)}

        # 4. Auto-screen the sample candidates for instant demo
        job_candidates = db.list_candidates_for_job(job_id)
        for idx, cand in enumerate(job_candidates):
            try:
                scored = score_candidate_against_job(cand["id"], job_id)
                # Assign initial diverse statuses for rich demo view
                if idx in (0, 1) and cand.get("status") == "new":
                    db.update_candidate_status_notes(cand["id"], status="shortlisted", notes="Top tier match on Must-Haves.")
                elif idx in (2, 3) and cand.get("status") == "new":
                    db.update_candidate_status_notes(cand["id"], status="maybe", notes="Strong technical foundations, review gaps in phone screen.")
            except Exception as sc_err:
                logging.warning(f"Demo auto-screen notice for {cand['filename']}: {sc_err}")

        refreshed_job = db.get_job(job_id)
        refreshed_candidates = db.list_candidates_for_job(job_id)

        return {
            "message": f"Successfully loaded {copied_count} demo resumes, created Job Workspace, and scored all candidates!",
            "resumes_loaded": sample_files,
            "job": refreshed_job,
            "candidates": refreshed_candidates,
            "pipeline_stats": stats,
        }

    except Exception as e:
        logging.error(f"Error loading sample data: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Failed to load sample data: {str(e)}"})


# ─────────────────────────────────────────────────────────────
# 6. Legacy Upload & Predict (Maintained for Backward Compatibility)
# ─────────────────────────────────────────────────────────────

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

        # Auto create or use job
        jobs = db.list_jobs()
        job = jobs[0] if jobs else create_job_with_requirements(jd_text)

        has_new_files = bool(resumes and any(f and f.filename for f in resumes))
        saved_files = []

        if has_new_files:
            import uuid
            from langchain_community.document_loaders import PyPDFLoader
            for file in resumes:
                if file and file.filename and allowed_file(file.filename):
                    filename = sanitize_filename(file.filename)
                    target_file = pdfs_path / filename
                    with open(target_file, "wb") as out:
                        shutil.copyfileobj(file.file, out)
                    saved_files.append(filename)

                    try:
                        loader = PyPDFLoader(str(target_file))
                        pages = [p.page_content for p in loader.load()]
                        prof = extract_profile_from_pages(filename, pages)
                    except Exception:
                        prof = {"candidate_name": Path(filename).stem, "top_skills": "", "estimated_years_exp": 2, "education": ""}

                    db.add_candidate({
                        "id": str(uuid.uuid4()),
                        "job_id": job["id"],
                        "filename": filename,
                        "name": prof.get("candidate_name") or filename,
                        "skills": prof.get("top_skills", ""),
                        "education": prof.get("education", ""),
                        "years_exp": prof.get("estimated_years_exp", 2.0),
                        "status": "new"
                    })

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
            "job": job
        }

    except Exception as e:
        logging.error(f"Error in upload_resumes: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Upload processing failed: {str(e)}"})


@app.post("/api/reset")
def reset_uploads(_auth: bool = Depends(verify_token_optional)):
    """Resets the uploaded files and clears the ChromaDB vector database and jobs SQLite DB."""
    import gc
    try:
        # 1. Clear uploaded files
        for folder in [jd_path, pdfs_path]:
            if folder.exists():
                for filename in os.listdir(folder):
                    file_path = folder / filename
                    if file_path.is_file():
                        try:
                            file_path.unlink()
                        except PermissionError:
                            logging.warning(f"Could not unlink locked file: {file_path}")

        # 2. Invalidate cached Chroma handles & force GC before deleting vector store
        invalidate_chroma_cache()
        gc.collect()

        if DATABASE_PATH.exists():
            try:
                shutil.rmtree(DATABASE_PATH)
            except PermissionError:
                # On Windows, ChromaDB's SQLite handle may remain open in-process.
                # Fall back to clearing all collections/documents via Chroma client API.
                logging.warning("Windows file lock on chroma directory; purging collections via Chroma API.")
                try:
                    import chromadb
                    client = chromadb.PersistentClient(path=str(DATABASE_PATH))
                    for col in client.list_collections():
                        col_name = col.name if hasattr(col, "name") else str(col)
                        client.delete_collection(col_name)
                except Exception as chroma_err:
                    logging.warning(f"Chroma API purge notice: {chroma_err}")

        # 3. Clear jobs, requirements, candidates, and scores in SQLite
        with db._connect() as conn:
            conn.execute("DELETE FROM scores")
            conn.execute("DELETE FROM candidates")
            conn.execute("DELETE FROM requirements")
            conn.execute("DELETE FROM jobs")

        # 4. Clear legacy candidate_profiles in metrics_store
        try:
            metrics_store.clear_candidate_profiles()
        except Exception:
            pass

        return {"message": "All uploads, jobs, and vector databases have been reset."}

    except Exception as e:
        logging.error(f"Error resetting uploads: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Failed to reset uploads: {str(e)}"})


@app.post("/api/predict")
def predict(payload: PredictRequest):
    """Endpoint to query the RAG pipeline for answers based on job descriptions and resumes."""
    try:
        question = payload.question.strip()
        if not question:
            return JSONResponse(status_code=400, content={"error": "A question is required."})

        job_description = (payload.job_description or "").strip()
        if not job_description and payload.job_id:
            job = db.get_job(payload.job_id)
            if job:
                job_description = job.get("description", "")

        if not job_description:
            jd_file = jd_path / "job_description.txt"
            if jd_file.exists():
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
        if not job_description and payload.job_id:
            job = db.get_job(payload.job_id)
            if job:
                job_description = job.get("description", "")

        if not job_description:
            jd_file = jd_path / "job_description.txt"
            if jd_file.exists():
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


# ─────────────────────────────────────────────────────────────
# 7. AIOps Observability, Evaluation & Metrics API
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
