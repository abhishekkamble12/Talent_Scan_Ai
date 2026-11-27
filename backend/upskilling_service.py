"""
TalentScan AI: Upskilling & Skill Gap Service
=============================================
Analyzes candidate gaps and missing requirements against job specs
to produce actionable, structured learning roadmaps with recommended
courses, certifications, portfolio projects, and time-to-close estimates.
"""

from typing import List, Dict, Any, Optional
import re


# Curated catalog of skills to course & project mappings
SKILL_KNOWLEDGE_BASE = {
    "kubernetes": {
        "display": "Kubernetes & Container Orchestration",
        "courses": ["Certified Kubernetes Administrator (CKA) - Linux Foundation", "Kubernetes for Developers (Coursera/Google Cloud)"],
        "project": "Deploy a microservice cluster on Minikube with Helm charts, Ingress, and horizontal pod autoscaling.",
        "est_weeks": "3-4 weeks"
    },
    "k8s": {
        "display": "Kubernetes & Container Orchestration",
        "courses": ["Certified Kubernetes Administrator (CKA) - Linux Foundation", "Kubernetes for Developers (Coursera/Google Cloud)"],
        "project": "Deploy a microservice cluster on Minikube with Helm charts, Ingress, and horizontal pod autoscaling.",
        "est_weeks": "3-4 weeks"
    },
    "docker": {
        "display": "Docker & Containerization",
        "courses": ["Docker for Beginners (Docker Certified Associate track)", "Containerized Applications with Docker (freeCodeCamp)"],
        "project": "Containerize a full-stack multi-container app with docker-compose, multi-stage builds, and non-root users.",
        "est_weeks": "1-2 weeks"
    },
    "aws": {
        "display": "Amazon Web Services (AWS)",
        "courses": ["AWS Certified Solutions Architect - Associate", "AWS Cloud Practitioner Essentials"],
        "project": "Architect an event-driven serverless workflow using AWS Lambda, S3, SQS, and API Gateway with Terraform.",
        "est_weeks": "4-6 weeks"
    },
    "gcp": {
        "display": "Google Cloud Platform (GCP)",
        "courses": ["Google Cloud Professional Cloud Architect Track", "GCP Associate Cloud Engineer (Coursera)"],
        "project": "Deploy a containerized application to Google Cloud Run with Cloud SQL and Cloud Build CI/CD.",
        "est_weeks": "3-4 weeks"
    },
    "ci/cd": {
        "display": "CI/CD & DevOps Automation",
        "courses": ["GitHub Actions in Practice (GitHub Learning)", "DevOps Prerequisite Course (KodeKloud)"],
        "project": "Build an end-to-end GitHub Actions pipeline with automated linting, pytest, coverage gates, and Docker image tagging.",
        "est_weeks": "1-2 weeks"
    },
    "cicd": {
        "display": "CI/CD & DevOps Automation",
        "courses": ["GitHub Actions in Practice (GitHub Learning)", "GitLab CI: From Zero to Hero"],
        "project": "Build an end-to-end automated deployment pipeline with branch protection and semantic release.",
        "est_weeks": "1-2 weeks"
    },
    "react": {
        "display": "Modern React & State Management",
        "courses": ["Full Stack Open (University of Helsinki)", "Epic React by Kent C. Dodds"],
        "project": "Build a responsive dashboard using React 18, React Query, Zustand, and Tailwind CSS with optimistic UI updates.",
        "est_weeks": "2-3 weeks"
    },
    "typescript": {
        "display": "TypeScript for Enterprise Applications",
        "courses": ["Total TypeScript by Matt Pocock", "TypeScript Design Patterns (Coursera)"],
        "project": "Refactor a dynamic JavaScript client to strict TypeScript with generic API handlers and Zod validation.",
        "est_weeks": "2 weeks"
    },
    "python": {
        "display": "Advanced Python & Asynchronous APIs",
        "courses": ["FastAPI - The Complete Course (Udemy)", "Fluent Python by Luciano Ramalho"],
        "project": "Build an async REST/WebSocket service using FastAPI, asyncpg, and Redis background queues.",
        "est_weeks": "2-3 weeks"
    },
    "fastapi": {
        "display": "FastAPI & Microservices Architecture",
        "courses": ["Modern Asynchronous Python with FastAPI", "Microservices with FastAPI and Docker"],
        "project": "Create high-throughput JSON API with Pydantic v2 validation, OAuth2 JWT auth, and Alembic migrations.",
        "est_weeks": "2 weeks"
    },
    "graphql": {
        "display": "GraphQL APIs & Apollo Federation",
        "courses": ["Apollo Odyssey: Associate & Professional Certifications", "GraphQL with React and Node (Frontend Masters)"],
        "project": "Implement a federated GraphQL gateway stitching together candidate profile and scoring services.",
        "est_weeks": "2 weeks"
    },
    "postgres": {
        "display": "PostgreSQL Performance & Query Optimization",
        "courses": ["Use The Index, Luke! - SQL Indexing & Tuning", "PostgreSQL for Everybody (Coursera)"],
        "project": "Design a schema with partitioned tables, EXPLAIN ANALYZE query tuning, and foreign key indexes.",
        "est_weeks": "2 weeks"
    },
    "sql": {
        "display": "Relational Database Design & Complex SQL",
        "courses": ["SQL for Data Analysis (Mode Analytics)", "Advanced SQL for Engineers"],
        "project": "Write window functions, CTEs, and recursive queries for analytical reporting on hierarchical data.",
        "est_weeks": "1-2 weeks"
    },
    "rag": {
        "display": "Retrieval-Augmented Generation (RAG) & Vector Search",
        "courses": ["Building RAG Applications with Chroma & LangChain (DeepLearning.AI)", "Vector Databases in Production"],
        "project": "Build an enterprise document QA engine using hybrid dense+sparse retrieval, reranking, and citation anchors.",
        "est_weeks": "2-3 weeks"
    },
    "llm": {
        "display": "LLM Integration & Prompt Engineering",
        "courses": ["DeepLearning.AI: Prompt Engineering for Developers", "Generative AI Engineering with Gemini"],
        "project": "Develop a structured output parser with Pydantic JSON schemas, fallback retry handlers, and token tracking.",
        "est_weeks": "2 weeks"
    },
    "terraform": {
        "display": "Infrastructure as Code (Terraform / OpenTofu)",
        "courses": ["HashiCorp Certified: Terraform Associate", "Terraform Bootcamp (freeCodeCamp)"],
        "project": "Provision a multi-AZ VPC, managed database, and auto-scaling group using reusable Terraform modules.",
        "est_weeks": "2-3 weeks"
    },
    "testing": {
        "display": "Automated Testing (Unit, Integration, E2E)",
        "courses": ["Test-Driven Development in Python with Pytest", "Playwright Modern E2E Testing"],
        "project": "Implement 90%+ branch test coverage with unit fixtures, mocked HTTP dependencies, and Playwright integration tests.",
        "est_weeks": "1-2 weeks"
    }
}


def _match_catalog_entry(requirement_text: str) -> Optional[Dict[str, Any]]:
    """Matches requirement text keywords against known catalog items."""
    text_lower = requirement_text.lower()
    for key, item in SKILL_KNOWLEDGE_BASE.items():
        pattern = r"\b" + re.escape(key) + r"\b"
        if re.search(pattern, text_lower):
            return item
    return None


def generate_candidate_upskilling_plan(candidate: Dict[str, Any], job_title: str = "") -> Dict[str, Any]:
    """
    Generates a personalized upskilling roadmap for missing or partial requirements.
    Works for both recruiters sharing feedback and candidates self-checking.
    """
    requirements = candidate.get("requirements", [])
    candidate_name = candidate.get("name") or candidate.get("filename", "Candidate")
    fit_score = candidate.get("fit_score", 0)

    roadmaps = []
    seen_skills = set()

    # Scan requirement verdicts
    for req in requirements:
        verdict = req.get("verdict", "missing")
        if verdict in ("missing", "partial"):
            req_text = req.get("requirement_text") or req.get("text") or ""
            category = req.get("requirement_category") or req.get("category", "must_have")

            catalog_entry = _match_catalog_entry(req_text)
            skill_name = catalog_entry["display"] if catalog_entry else req_text.split(" - ")[0].split(":")[0]

            if skill_name.lower() in seen_skills:
                continue
            seen_skills.add(skill_name.lower())

            if catalog_entry:
                roadmaps.append({
                    "skill": catalog_entry["display"],
                    "verdict": verdict,
                    "requirement_context": req_text,
                    "priority": "High (Must-Have)" if category == "must_have" else "Medium (Nice-to-Have)",
                    "category": category,
                    "courses": catalog_entry["courses"],
                    "practice_project": catalog_entry["project"],
                    "time_to_close": catalog_entry["est_weeks"]
                })
            else:
                roadmaps.append({
                    "skill": skill_name,
                    "verdict": verdict,
                    "requirement_context": req_text,
                    "priority": "High (Must-Have)" if category == "must_have" else "Medium (Nice-to-Have)",
                    "category": category,
                    "courses": [f"Complete practical online course on {skill_name}", f"Official documentation & tutorials for {skill_name}"],
                    "practice_project": f"Build and document a real-world repository demonstrating hands-on experience with {skill_name}.",
                    "time_to_close": "2-3 weeks"
                })

    # If no requirements were marked missing (100% fit or all met)
    if not roadmaps:
        coaching_summary = (
            f"{candidate_name} exhibits excellent alignment with all core requirements for {job_title or 'this role'}. "
            "To stand out even further, focus on system architecture discussions, leadership examples, and cross-functional impact."
        )
    else:
        must_gaps = [r["skill"] for r in roadmaps if r["category"] == "must_have"]
        nice_gaps = [r["skill"] for r in roadmaps if r["category"] == "nice_to_have"]

        coaching_summary = f"{candidate_name} holds a {fit_score}/100 match for {job_title or 'the role'}. "
        if must_gaps:
            coaching_summary += f"Prioritizing hands-on mastery in {', '.join(must_gaps[:2])} will dramatically increase interview conversion. "
        if nice_gaps:
            coaching_summary += f"Adding familiarity with {', '.join(nice_gaps[:2])} provides an extra competitive edge."

    return {
        "candidate_id": candidate.get("id"),
        "candidate_name": candidate_name,
        "job_title": job_title,
        "fit_score": fit_score,
        "total_gaps_identified": len(roadmaps),
        "coaching_summary": coaching_summary,
        "roadmap_items": roadmaps
    }
