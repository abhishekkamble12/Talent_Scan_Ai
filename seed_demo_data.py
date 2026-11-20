"""
Seed Script for AI Resume Screener Demo
=======================================
This script populates sample candidate resumes and a sample Job Description into
the system, runs the RAG ingestion pipeline, and prepares ChromaDB for demoing.

Usage:
    python seed_demo_data.py
"""

import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

SAMPLE_PDFS_DIR = PROJECT_ROOT / "bot" / "data" / "pdfs"
UPLOAD_PDFS_DIR = PROJECT_ROOT / "uploads" / "pdfs"
UPLOAD_JD_DIR = PROJECT_ROOT / "uploads" / "jd"
CHROMA_DIR = PROJECT_ROOT / "chroma"

DEFAULT_SAMPLE_JD = """Full Stack Software Engineer (React & Python)

About the Role:
We are looking for a proactive Full Stack Engineer to build scalable web applications. You will collaborate closely with cross-functional teams to design, develop, and deploy cloud-native software products.

Key Responsibilities:
- Build responsive, accessible front-end interfaces using React, TypeScript, and modern styling libraries (TailwindCSS).
- Develop robust RESTful and GraphQL APIs using Python (FastAPI / Flask / Django).
- Work with relational and vector databases (PostgreSQL, ChromaDB / Pinecone).
- Integrate LLM-powered services, Retrieval-Augmented Generation (RAG) pipelines, and intelligent search agents.
- Write unit, integration, and end-to-end tests to guarantee high code reliability.
- Participate in agile sprints, code reviews, and architectural discussions.

Qualifications & Skills:
- 2+ years of professional software engineering experience.
- Strong proficiency in modern JavaScript/TypeScript, React, HTML5, and CSS.
- Proven backend development skills in Python and database schema design.
- Familiarity with Git, Docker, CI/CD pipelines, and cloud platforms (GCP or AWS).
- Problem-solving mindset, clean code habits, and strong team communication skills.
"""


def main():
    print("=" * 60)
    print("      AI RESUME SCREENER - SEED DEMO DATA")
    print("=" * 60)

    # 1. Check sample resumes
    if not SAMPLE_PDFS_DIR.exists():
        print(f"[ERROR] Sample PDFs directory not found at: {SAMPLE_PDFS_DIR}")
        return

    sample_files = [f for f in os.listdir(SAMPLE_PDFS_DIR) if f.lower().endswith(".pdf")]
    if not sample_files:
        print("[ERROR] No sample PDF files found in bot/data/pdfs/")
        return

    print(f"[1/4] Found {len(sample_files)} sample candidate resumes in bot/data/pdfs/.")

    # 2. Copy to uploads/pdfs
    UPLOAD_PDFS_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_JD_DIR.mkdir(parents=True, exist_ok=True)

    for fname in sample_files:
        shutil.copy2(SAMPLE_PDFS_DIR / fname, UPLOAD_PDFS_DIR / fname)
    print(f"[2/4] Copied {len(sample_files)} resumes to uploads/pdfs/.")

    # 3. Write sample JD
    with open(UPLOAD_JD_DIR / "job_description.txt", "w", encoding="utf-8") as f:
        f.write(DEFAULT_SAMPLE_JD)
    print("[3/4] Saved standard Software Engineer Job Description.")

    # 4. Check API Key
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key or "your_gemini_api_key_here" in api_key.lower():
        print("\n[NOTE] GOOGLE_API_KEY is not yet set in .env.")
        print("Resumes have been copied to uploads/pdfs, but indexing into ChromaDB requires an API key.")
        print("Please add your key in .env and run this script or start the app.\n")
        return

    # 5. Run RAG Pipeline
    print("[4/4] Ingesting documents into ChromaDB vector store...")
    import sys
    sys.path.insert(0, str(PROJECT_ROOT / "backend"))
    from rag_pipeline import RAGPipeline

    pipeline = RAGPipeline(
        data_path=str(UPLOAD_PDFS_DIR),
        database_path=str(CHROMA_DIR),
        document_type="pdf",
    )
    result = pipeline.run_pipeline()
    print("\n[SUCCESS] Pipeline completed successfully!")
    print(f"Stats: {result}")
    print("\nYour project is ready for demo! Run: start_project.bat\n")


if __name__ == "__main__":
    main()
