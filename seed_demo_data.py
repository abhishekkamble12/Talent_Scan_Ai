"""
Seed Script for AI Resume Screener Demo
=======================================
Populates sample candidate resumes and standard Job Description into the system,
creates the Job Workspace with Must-Have and Nice-to-Have criteria, runs ChromaDB indexing,
and pre-scores candidates for instant demonstration.

Usage:
    python seed_demo_data.py
"""

import os
import sys
import shutil
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
sys.path.insert(0, str(PROJECT_ROOT))

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

SAMPLE_PDFS_DIR = PROJECT_ROOT / "bot" / "data" / "pdfs"
UPLOAD_PDFS_DIR = PROJECT_ROOT / "uploads" / "pdfs"
UPLOAD_JD_DIR = PROJECT_ROOT / "uploads" / "jd"
CHROMA_DIR = PROJECT_ROOT / "chroma"

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

SAMPLE_NAMES = {
    "Resume_1.pdf": "Aaryan Palve",
    "Resume_5.pdf": "Nidhish Wakodikar",
    "Resume_6.pdf": "Piyush Choudhari",
    "Resume_8.pdf": "Rushikesh Kulkarni",
    "Resume_9.pdf": "Yash Mhaskar",
    "Resume_10.pdf": "Uday Bhole",
}


def main():
    print("=" * 60)
    print("      TALENTSCAN AI - INSTANT DEMO SEEDER")
    print("=" * 60)

    # 1. Check sample resumes
    if not SAMPLE_PDFS_DIR.exists():
        print(f"[ERROR] Sample PDFs directory not found at: {SAMPLE_PDFS_DIR}")
        return

    sample_files = [f for f in os.listdir(SAMPLE_PDFS_DIR) if f.lower().endswith(".pdf")]
    if not sample_files:
        print("[ERROR] No sample PDF files found in bot/data/pdfs/")
        return

    print(f"[1/5] Found {len(sample_files)} sample candidate resumes in bot/data/pdfs/.")

    # 2. Copy to uploads/pdfs
    UPLOAD_PDFS_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_JD_DIR.mkdir(parents=True, exist_ok=True)

    for fname in sample_files:
        shutil.copy2(SAMPLE_PDFS_DIR / fname, UPLOAD_PDFS_DIR / fname)
    print(f"[2/5] Copied {len(sample_files)} resumes to uploads/pdfs/.")

    with open(UPLOAD_JD_DIR / "job_description.txt", "w", encoding="utf-8") as f:
        f.write(DEFAULT_SAMPLE_JD)
    print("[3/5] Saved default Role Criteria.")

    # 3. Create Job Workspace & Register Candidates in SQLite
    print("[4/5] Initializing SQLite Job Workspace & Requirement Chips...")
    from database import db
    from job_service import create_job_with_requirements
    from scoring_service import score_candidate_against_job
    from candidate_extractor import extract_profile_from_pages
    from langchain_community.document_loaders import PyPDFLoader
    import uuid

    existing_jobs = db.list_jobs()
    sample_job = next((j for j in existing_jobs if "Full Stack Software Engineer" in j.get("title", "")), None)

    if not sample_job:
        sample_job = create_job_with_requirements(
            description=DEFAULT_SAMPLE_JD,
            title="Full Stack Software Engineer (React & Python)"
        )
    job_id = sample_job["id"]

    for fname in sample_files:
        existing_cands = db.list_candidates_for_job(job_id)
        existing_cand = next((c for c in existing_cands if c.get("filename") == fname), None)

        dst = UPLOAD_PDFS_DIR / fname
        try:
            loader = PyPDFLoader(str(dst))
            pages = [p.page_content for p in loader.load()]
            profile = extract_profile_from_pages(fname, pages)
        except Exception:
            profile = {
                "candidate_name": SAMPLE_NAMES.get(fname, fname),
                "top_skills": "Python, React, FastAPI",
                "estimated_years_exp": 3.0,
                "education": "B.S. Computer Science",
                "summary": ""
            }

        cand_name = SAMPLE_NAMES.get(fname) or profile.get("candidate_name") or fname

        if existing_cand:
            # Update candidate name
            with db._connect() as conn:
                conn.execute("UPDATE candidates SET name = ? WHERE id = ?", (cand_name, existing_cand["id"]))
            cand_id = existing_cand["id"]
        else:
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

        # Pre-score candidate
        score_candidate_against_job(cand_id, job_id)

    # Assign diverse statuses for rich demo pipeline view
    candidates = db.list_candidates_for_job(job_id)
    for idx, c in enumerate(candidates):
        if idx in (0, 1):
            db.update_candidate_status_notes(c["id"], status="shortlisted", notes="Top tier match on Must-Haves.")
        elif idx in (2, 3):
            db.update_candidate_status_notes(c["id"], status="maybe", notes="Strong foundations, review gaps in interview.")

    # 4. Optional ChromaDB indexing
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if api_key and "your_gemini_api_key_here" not in api_key.lower():
        print("[5/5] Ingesting documents into ChromaDB vector store...")
        try:
            from rag_pipeline import RAGPipeline
            pipeline = RAGPipeline(
                data_path=str(UPLOAD_PDFS_DIR),
                database_path=str(CHROMA_DIR),
                document_type="pdf",
            )
            pipeline.run_pipeline()
            print("  -> ChromaDB vector store updated successfully.")
        except Exception as e:
            print(f"  -> Vector store notice: {e}")
    else:
        print("[5/5] Skipped remote vector embedding (No API key set).")

    print("\n" + "=" * 60)
    print("SUCCESS: 1-Click Demo data is fully prepared and pre-screened!")
    print(f"Job: {sample_job['title']}")
    print(f"Candidates Indexed: {len(candidates)}")
    for c in candidates:
        print(f" • {c.get('name')}: Fit {c.get('fit_score')}% | Must-Haves: {c.get('must_haves_met')}/{c.get('must_haves_total')} | Status: {c.get('status').upper()}")
    print("=" * 60)
    print("\nLaunch the application with: .\\start_project.bat\n")


if __name__ == "__main__":
    main()
