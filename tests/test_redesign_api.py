"""
Unit & Integration Tests for Redesigned TalentScan API
=====================================================
Tests Jobs workspace, editable requirement chips, candidate scoring,
evidence retrieval, status updates, comparison matrix, and CSV export.
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app
from backend.database import db

client = TestClient(app)


def test_job_lifecycle_and_requirements():
    """Test job creation, requirement extraction, requirement editing, and retrieval."""
    # 1. Create Job
    jd = """Senior Backend Engineer
Requirements:
- 5+ years Python and FastAPI experience
- Extensive PostgreSQL database modeling
- Docker and Kubernetes orchestration
Nice to have:
- React frontend familiarity
- Cloud experience with AWS or GCP
"""
    res = client.post("/api/jobs", json={"title": "Senior Backend Engineer", "description": jd})
    assert res.status_code == 200, res.text
    job = res.json()
    assert job["id"]
    assert job["title"] == "Senior Backend Engineer"
    assert len(job["requirements"]) >= 3
    job_id = job["id"]

    # 2. Get Job
    get_res = client.get(f"/api/jobs/{job_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == job_id

    # 3. List Jobs
    list_res = client.get("/api/jobs")
    assert list_res.status_code == 200
    assert any(j["id"] == job_id for j in list_res.json()["jobs"])

    # 4. Edit Requirements
    existing_reqs = job["requirements"]
    updated_reqs = [
        {"id": existing_reqs[0]["id"], "text": "6+ years Python & FastAPI", "category": "must_have", "sort_order": 0},
        {"text": "Redis caching and message queues", "category": "must_have", "sort_order": 1},
        {"text": "GraphQL API design", "category": "nice_to_have", "sort_order": 2},
    ]
    patch_res = client.patch(f"/api/jobs/{job_id}/requirements", json={"requirements": updated_reqs})
    assert patch_res.status_code == 200
    assert len(patch_res.json()["requirements"]) == 3
    assert patch_res.json()["requirements"][0]["text"] == "6+ years Python & FastAPI"


def test_candidate_scoring_detail_and_decision():
    """Test candidate addition, scoring, evidence citations, decision updates, and export."""
    # Create Job
    job_res = client.post("/api/jobs", json={
        "title": "Platform Engineer",
        "description": "Must have: Python, Docker. Nice to have: Kubernetes."
    })
    job_id = job_res.json()["id"]

    # Manually insert candidate via DB for testing
    import uuid
    cand_id = str(uuid.uuid4())
    db.add_candidate({
        "id": cand_id,
        "job_id": job_id,
        "filename": "A_Sharma_Resume.pdf",
        "name": "A. Sharma",
        "skills": "Python, Docker, FastAPI",
        "education": "B.Tech Computer Science",
        "years_exp": 4.0,
        "status": "new"
    })

    # Test candidate detail (triggers auto-scoring)
    detail_res = client.get(f"/api/candidates/{cand_id}")
    assert detail_res.status_code == 200, detail_res.text
    cand = detail_res.json()
    assert cand["id"] == cand_id
    assert cand["fit_score"] > 0
    assert len(cand["requirements"]) > 0
    assert "interview_questions" in cand

    # Test decision PATCH (Shortlist with notes)
    patch_res = client.patch(f"/api/candidates/{cand_id}", json={
        "status": "shortlisted",
        "notes": "Strong Docker experience, schedule round 1 interview."
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "shortlisted"
    assert "round 1" in patch_res.json()["notes"]

    # Test candidate list with filters
    list_res = client.get(f"/api/jobs/{job_id}/candidates?status=shortlisted")
    assert list_res.status_code == 200
    assert len(list_res.json()["candidates"]) == 1

    # Test comparison matrix
    compare_res = client.post(f"/api/jobs/{job_id}/compare", json={"candidate_ids": [cand_id]})
    assert compare_res.status_code == 200
    matrix_data = compare_res.json()
    assert "matrix" in matrix_data
    assert len(matrix_data["candidates"]) == 1

    # Test CSV export
    export_res = client.get(f"/api/jobs/{job_id}/export")
    assert export_res.status_code == 200
    assert "text/csv" in export_res.headers.get("content-type", "")
    assert "A. Sharma" in export_res.text
