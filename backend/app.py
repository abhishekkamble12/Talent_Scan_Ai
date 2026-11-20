import os
import logging
import shutil
from pathlib import Path
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Ensure backend directory is in sys.path
import sys
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from utils import query_rag, get_api_key
from rag_pipeline import RAGPipeline

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

CORS(
    app,
    resources={
        r"/*": {"origins": ["*", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]}
    },
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


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "service": "resume-screener-api"}), 200


@app.route("/api/status", methods=["GET"])
def get_status():
    """
    Returns the current configuration, uploaded resumes count, and JD status.
    """
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

    return jsonify(
        {
            "resumes_count": len(existing_pdfs),
            "resumes": existing_pdfs,
            "has_job_description": has_jd,
            "job_description_snippet": (jd_content[:300] + "...") if len(jd_content) > 300 else jd_content,
            "job_description_full": jd_content,
            "api_key_configured": has_api_key,
        }
    ), 200


@app.route("/api/load-sample", methods=["POST"])
def load_sample_data():
    """
    Pre-loads bundled sample resumes and a standard Software Engineer JD for instant 1-click demos.
    """
    try:
        if not SAMPLE_PDFS_DIR.exists():
            return jsonify({"error": "Sample resumes directory not found."}), 404

        sample_files = [f for f in os.listdir(SAMPLE_PDFS_DIR) if f.lower().endswith(".pdf")]
        if not sample_files:
            return jsonify({"error": "No sample PDFs found in bot/data/pdfs."}), 404

        copied_count = 0
        for fname in sample_files:
            src = SAMPLE_PDFS_DIR / fname
            dst = pdfs_path / fname
            shutil.copy2(src, dst)
            copied_count += 1

        # Write sample JD
        with open(jd_path / "job_description.txt", "w", encoding="utf-8") as f:
            f.write(DEFAULT_SAMPLE_JD)

        # Run RAG Pipeline
        pipeline = RAGPipeline(
            document_type="pdf",
            data_path=str(pdfs_path),
            database_path=str(DATABASE_PATH),
        )
        stats = pipeline.run_pipeline()

        return jsonify(
            {
                "message": f"Successfully loaded {copied_count} demo resumes and sample job description!",
                "resumes_loaded": sample_files,
                "job_description": DEFAULT_SAMPLE_JD,
                "pipeline_stats": stats,
            }
        ), 200

    except Exception as e:
        logging.error(f"Error loading sample data: {e}", exc_info=True)
        return jsonify({"error": f"Failed to load sample data: {str(e)}"}), 500


@app.route("/api/upload", methods=["POST"])
def upload_resumes():
    """
    Uploads job description and resumes as part of a multi-part form-data request.
    """
    try:
        job_description = request.form.get("job_description", "").strip()
        uploaded_files = request.files.getlist("resumes")

        if not uploaded_files or uploaded_files[0].filename == "":
            return jsonify({"error": "Please provide at least one PDF resume."}), 400

        if not job_description:
            return jsonify({"error": "Job description is required."}), 400

        saved_files = []
        for file in uploaded_files:
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                target_file = pdfs_path / filename
                file.save(str(target_file))
                saved_files.append(filename)

        if not saved_files:
            return jsonify({"error": "No valid PDF files were provided."}), 400

        with open(jd_path / "job_description.txt", "w", encoding="utf-8") as jd_file:
            jd_file.write(job_description)

        rag_pipeline = RAGPipeline(
            document_type="pdf",
            data_path=str(pdfs_path),
            database_path=str(DATABASE_PATH),
        )
        pipeline_stats = rag_pipeline.run_pipeline()

        return jsonify(
            {
                "message": f"Successfully ingested {len(saved_files)} resumes and indexed content.",
                "saved_files": saved_files,
                "pipeline_stats": pipeline_stats,
            }
        ), 200

    except Exception as e:
        logging.error(f"Error in upload_resumes: {e}", exc_info=True)
        return jsonify({"error": f"Upload processing failed: {str(e)}"}), 500


@app.route("/api/reset", methods=["POST"])
def reset_uploads():
    """
    Resets the uploaded files and clears the ChromaDB vector database.
    """
    try:
        for folder in [jd_path, pdfs_path]:
            if folder.exists():
                for filename in os.listdir(folder):
                    file_path = folder / filename
                    if file_path.is_file():
                        file_path.unlink()

        if DATABASE_PATH.exists():
            shutil.rmtree(DATABASE_PATH)

        return jsonify({"message": "All uploads and vector databases have been reset."}), 200

    except Exception as e:
        logging.error(f"Error resetting uploads: {e}", exc_info=True)
        return jsonify({"error": "Failed to reset uploads."}), 500


@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Endpoint to query the RAG pipeline for answers based on job descriptions and resumes.
    """
    try:
        data = request.get_json(silent=True) or {}
        question = data.get("question", "").strip()

        if not question:
            return jsonify({"error": "A question is required."}), 400

        job_description = data.get("job_description", "").strip()
        jd_file = jd_path / "job_description.txt"

        if not job_description and jd_file.exists():
            with open(jd_file, "r", encoding="utf-8") as f:
                job_description = f.read()

        response = query_rag(
            job_description=job_description,
            question=question,
            database_path=str(DATABASE_PATH),
        )

        return jsonify({"answer": response}), 200

    except Exception as e:
        logging.error(f"Error in /api/predict: {e}", exc_info=True)
        return jsonify({"error": f"An error occurred while processing: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
