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


def test_v2_shareable_link_and_public_scorecard():
    """Test generating a secure shareable link and loading public scorecard without recruiter notes."""
    import uuid
    # Create Job and Candidate
    job = client.post("/api/jobs", json={
        "title": "Full Stack Dev",
        "description": "Must have: React, Python. Nice to have: Docker."
    }).json()

    c_id = str(uuid.uuid4())
    db.add_candidate({
        "id": c_id,
        "job_id": job["id"],
        "filename": "candidate_jane.pdf",
        "name": "Jane Doe",
        "skills": "React, Python, TailwindCSS",
        "years_exp": 3.0,
        "status": "shortlisted",
        "notes": "CONFIDENTIAL RECRUITER NOTE: Target salary $140k"
    })
    # Trigger scoring
    client.get(f"/api/candidates/{c_id}")

    # Generate share link
    share_res = client.post(f"/api/candidates/{c_id}/share")
    assert share_res.status_code == 200, share_res.text
    share_data = share_res.json()
    assert "share_token" in share_data
    token = share_data["share_token"]

    # Public scorecard retrieval
    public_res = client.get(f"/api/public/share/{token}")
    assert public_res.status_code == 200, public_res.text
    card = public_res.json()
    assert card["name"] == "Jane Doe"
    assert card["job_title"] == "Full Stack Dev"
    assert card["fit_score"] > 0
    assert len(card["requirements"]) > 0
    # Crucial security check: recruiter private notes must NEVER leak in public scorecard
    assert "notes" not in card
    assert "CONFIDENTIAL" not in str(card)

    # Revoke share link
    revoke_res = client.delete(f"/api/candidates/{c_id}/share")
    assert revoke_res.status_code == 200
    # Now public link should 404
    assert client.get(f"/api/public/share/{token}").status_code == 404


def test_v2_job_analytics_and_funnel():
    """Test job funnel conversion, drop-off root causes, and source-of-hire quality."""
    import uuid
    job = client.post("/api/jobs", json={
        "title": "Cloud Architect",
        "description": "Must have: AWS, Terraform. Nice to have: Kubernetes."
    }).json()
    job_id = job["id"]

    # Add candidates with various sources and statuses
    c1 = str(uuid.uuid4())
    db.add_candidate({
        "id": c1,
        "job_id": job_id,
        "filename": "c1.pdf",
        "name": "C1 AWS Pro",
        "skills": "AWS, Terraform",
        "status": "shortlisted",
        "source": "referral"
    })
    client.get(f"/api/candidates/{c1}")

    c2 = str(uuid.uuid4())
    db.add_candidate({
        "id": c2,
        "job_id": job_id,
        "filename": "c2.pdf",
        "name": "C2 Junior",
        "skills": "HTML",
        "status": "rejected",
        "gaps": "Missing AWS; Missing Terraform",
        "source": "direct_upload"
    })

    # Fetch analytics
    analytics_res = client.get(f"/api/jobs/{job_id}/analytics")
    assert analytics_res.status_code == 200, analytics_res.text
    data = analytics_res.json()
    assert data["total_candidates"] == 2
    assert "funnel" in data
    assert len(data["funnel"]) == 4
    assert "source_quality" in data
    assert any(s["source"] == "Referral" for s in data["source_quality"])
    assert "top_dropoffs" in data
    assert any("AWS" in d["reason"] for d in data["top_dropoffs"])


def test_v2_upskilling_roadmap_and_smart_reranker():
    """Test skill gap upskilling roadmap generation and feedback-weighted reranking."""
    import uuid
    job = client.post("/api/jobs", json={
        "title": "DevOps Engineer",
        "description": "Must have: Kubernetes, Docker, CI/CD. Nice to have: Python."
    }).json()
    job_id = job["id"]

    # Candidate 1: Missing Kubernetes
    c1_id = str(uuid.uuid4())
    db.add_candidate({
        "id": c1_id,
        "job_id": job_id,
        "filename": "devops_c1.pdf",
        "name": "DevOps Novice",
        "skills": "Python, Linux",
        "status": "new"
    })
    # Score candidate
    client.get(f"/api/candidates/{c1_id}")

    # Test upskilling endpoint
    upskill_res = client.get(f"/api/candidates/{c1_id}/upskilling")
    assert upskill_res.status_code == 200, upskill_res.text
    upskill = upskill_res.json()
    assert "roadmap_items" in upskill
    assert len(upskill["roadmap_items"]) > 0
    # Kubernetes should map to curated project & courses
    k8s_item = next((item for item in upskill["roadmap_items"] if "kubernetes" in item["skill"].lower()), None)
    assert k8s_item is not None
    assert len(k8s_item["courses"]) > 0
    assert "project" in k8s_item["practice_project"].lower() or "deploy" in k8s_item["practice_project"].lower()

    # Add second candidate and assign decisions (c1=shortlisted, c2=rejected)
    c2_id = str(uuid.uuid4())
    db.add_candidate({
        "id": c2_id,
        "job_id": job_id,
        "filename": "devops_c2.pdf",
        "name": "DevOps Reject",
        "skills": "WordPress",
        "status": "rejected"
    })
    client.patch(f"/api/candidates/{c1_id}", json={"status": "shortlisted"})

    # Test smart rerank sorting
    rerank_res = client.get(f"/api/jobs/{job_id}/candidates?sort=smart_rerank")
    assert rerank_res.status_code == 200, rerank_res.text
    rerank_data = rerank_res.json()
    assert rerank_data["smart_rerank_active"] is True
    assert rerank_data["model_trained"] is True
    assert "Smart model active" in rerank_data["feedback_signal"]
    cands = rerank_data["candidates"]
    assert "smart_score" in cands[0]
    assert "smart_boost" in cands[0]

