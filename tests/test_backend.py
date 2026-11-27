"""
Test suite for TalentScan AI Backend API and Utilities
=====================================================
Uses FastAPI TestClient to verify routing, validation, security, and metrics.
"""

import os
import sys
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

# Add project root and backend to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app
from backend.candidate_extractor import (
    extract_skills_from_text,
    extract_candidate_name_from_text,
    extract_years_experience,
    extract_education,
    extract_profile_from_pages,
)
from backend.aiops_metrics import MetricsStore, QueryMetrics


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


def test_health_endpoint(client):
    """Verify /api/health returns 200 OK and expected payload."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "resume-screener-api"


def test_status_endpoint(client):
    """Verify /api/status returns operational status schema."""
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.json()
    assert "resumes_count" in data
    assert "resumes" in data
    assert "has_job_description" in data
    assert "api_key_configured" in data


def test_upload_missing_job_description(client):
    """Verify upload fails with 400 if job description is empty."""
    res = client.post("/api/upload", data={"job_description": ""})
    assert res.status_code == 400
    assert "job description is required" in res.json().get("error", "").lower()


def test_upload_corrupted_magic_bytes_rejected(client):
    """Verify upload rejects files without %PDF- magic bytes with 400."""
    fake_content = b"This is a text file disguised as a PDF"
    res = client.post(
        "/api/upload",
        data={"job_description": "Valid Job Description for testing"},
        files=[("resumes", ("fake_resume.pdf", fake_content, "application/pdf"))],
    )
    assert res.status_code == 400
    assert "not a valid pdf" in res.json().get("error", "").lower()


def test_candidates_endpoint(client):
    """Verify /api/candidates returns valid list structure."""
    res = client.get("/api/candidates")
    assert res.status_code == 200
    data = res.json()
    assert "candidates" in data
    assert "total" in data
    assert isinstance(data["candidates"], list)


def test_predict_empty_question_rejected(client):
    """Verify predict endpoint rejects empty questions with 400."""
    res = client.post("/api/predict", json={"question": "   "})
    assert res.status_code == 400
    assert "question is required" in res.json().get("error", "").lower()


def test_predict_stream_empty_question_rejected(client):
    """Verify streaming predict endpoint rejects empty questions with 400."""
    res = client.post("/api/predict/stream", json={"question": ""})
    assert res.status_code == 400


def test_candidate_extractor_skills():
    """Verify skill extraction taxonomy matches expected technologies."""
    sample_text = """
    Software Engineer with 6 years experience building scalable systems.
    Proficient in Python, FastAPI, React, TypeScript, and Docker.
    Hands-on with PostgreSQL, Redis, LangChain, and ChromaDB vector store.
    """
    skills = extract_skills_from_text(sample_text)
    assert "Python" in skills
    assert "FastAPI" in skills
    assert "React" in skills
    assert "TypeScript" in skills
    assert "Docker" in skills
    assert "ChromaDB" in skills


def test_candidate_extractor_years_and_education():
    """Verify experience and degree regex parsing."""
    sample_text = """
    Jane Developer
    B.S. in Computer Science from State University
    Over 5+ years of experience developing web applications.
    """
    years = extract_years_experience(sample_text)
    assert years == 5.0

    edu = extract_education(sample_text)
    assert "Computer Science" in edu or "B.S." in edu


def test_candidate_extractor_full_profile():
    """Verify full candidate profile dictionary assembly."""
    pages = [
        "Alex Rivera\nSenior Full Stack Engineer\nEmail: alex@example.com\nSummary: Passionate developer.",
        "Technical Skills: Python, React, AWS, Docker.\nEducation: Master of Science in Software Engineering."
    ]
    profile = extract_profile_from_pages("alex_rivera_resume.pdf", pages)
    assert profile["filename"] == "alex_rivera_resume.pdf"
    assert "Alex" in profile["candidate_name"]
    assert "Python" in profile["top_skills"]
    assert profile["estimated_years_exp"] >= 2.0


def test_metrics_store_lifecycle(tmp_path):
    """Verify SQLite metrics store handles queries and aggregations."""
    test_db = str(tmp_path / "test_metrics.db")
    store = MetricsStore(db_path=test_db)

    # Insert sample query
    qm = QueryMetrics(
        query_id="test1234",
        timestamp="2026-11-27T12:00:00Z",
        question="What are top skills?",
        total_e2e_latency_ms=450.0,
        model_used="gemini-3.5-flash-lite",
        status="success",
    )
    store.log_query(qm)

    # Update evaluation
    store.update_evaluation("test1234", {
        "answer_relevance": 5,
        "groundedness": 5,
        "coherence": 5,
        "completeness": 5,
        "hallucination_risk": 5,
        "eval_reasoning": "Strong match",
    })

    summary = store.get_summary(last_n=10)
    assert summary["total_queries"] == 1
    assert summary["avg_e2e_latency_ms"] == 450.0
    assert summary["avg_answer_relevance"] == 5.0
