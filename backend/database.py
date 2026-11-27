"""
TalentScan Database Layer (SQLite)
===================================
Manages persistent storage for Jobs, Requirements, Candidates, and Structured Scores.
Uses WAL mode, foreign keys, and dictionary-like Row factory.
"""

import sqlite3
import os
import json
import logging
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv("TALENTSCAN_DB_PATH", str(PROJECT_ROOT / "talentscan.db")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


class TalentScanDB:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or str(DB_PATH)
        self._init_db()

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path, timeout=15.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        with self._connect() as conn:
            # 1. Jobs Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            # 2. Requirements Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS requirements (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    text TEXT NOT NULL,
                    category TEXT NOT NULL CHECK(category IN ('must_have', 'nice_to_have')),
                    sort_order INTEGER DEFAULT 0,
                    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
                )
            """)

            # 3. Candidates Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS candidates (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    name TEXT DEFAULT '',
                    email TEXT DEFAULT '',
                    phone TEXT DEFAULT '',
                    skills TEXT DEFAULT '',
                    education TEXT DEFAULT '',
                    years_exp REAL DEFAULT 0,
                    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'shortlisted', 'maybe', 'rejected')),
                    notes TEXT DEFAULT '',
                    fit_score INTEGER DEFAULT 0,
                    summary TEXT DEFAULT '',
                    gaps TEXT DEFAULT '',
                    must_haves_met INTEGER DEFAULT 0,
                    must_haves_total INTEGER DEFAULT 0,
                    nice_to_haves_met INTEGER DEFAULT 0,
                    nice_to_haves_total INTEGER DEFAULT 0,
                    interview_questions TEXT DEFAULT '[]',
                    risk_flags TEXT DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
                )
            """)

            # 4. Scores Table (Candidate x Requirement evidence)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS scores (
                    id TEXT PRIMARY KEY,
                    candidate_id TEXT NOT NULL,
                    requirement_id TEXT NOT NULL,
                    verdict TEXT NOT NULL CHECK(verdict IN ('met', 'partial', 'missing')),
                    evidence_quote TEXT DEFAULT '',
                    page_number INTEGER DEFAULT 1,
                    confidence TEXT DEFAULT 'high' CHECK(confidence IN ('high', 'medium', 'low')),
                    reasoning TEXT DEFAULT '',
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
                    FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE,
                    UNIQUE(candidate_id, requirement_id)
                )
            """)

            # Indexes for high performance queries
            conn.execute("CREATE INDEX IF NOT EXISTS idx_requirements_job ON requirements(job_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_candidates_job ON candidates(job_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidates(job_id, fit_score DESC)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_scores_candidate ON scores(candidate_id)")

    # ─────────────────────────────────────────────────────────────
    # Job CRUD Operations
    # ─────────────────────────────────────────────────────────────

    def create_job(self, job_id: str, title: str, description: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO jobs (id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (job_id, title, description, now, now)
            )
        return self.get_job(job_id)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
            if not row:
                return None
            job = dict(row)
            # Fetch requirements
            req_rows = conn.execute(
                "SELECT * FROM requirements WHERE job_id = ? ORDER BY sort_order ASC, id ASC",
                (job_id,)
            ).fetchall()
            job["requirements"] = [dict(r) for r in req_rows]
            # Count candidates
            c_count = conn.execute("SELECT COUNT(*) as count FROM candidates WHERE job_id = ?", (job_id,)).fetchone()
            job["candidates_count"] = c_count["count"] if c_count else 0
            return job

    def list_jobs(self) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM jobs ORDER BY updated_at DESC").fetchall()
            jobs = []
            for r in rows:
                j = dict(r)
                req_rows = conn.execute(
                    "SELECT * FROM requirements WHERE job_id = ? ORDER BY sort_order ASC",
                    (j["id"],)
                ).fetchall()
                j["requirements"] = [dict(rq) for rq in req_rows]
                c_count = conn.execute("SELECT COUNT(*) as count FROM candidates WHERE job_id = ?", (j["id"],)).fetchone()
                j["candidates_count"] = c_count["count"] if c_count else 0
                jobs.append(j)
            return jobs

    def update_job(self, job_id: str, title: Optional[str] = None, description: Optional[str] = None) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            if title is not None and description is not None:
                conn.execute(
                    "UPDATE jobs SET title = ?, description = ?, updated_at = ? WHERE id = ?",
                    (title, description, now, job_id)
                )
            elif title is not None:
                conn.execute("UPDATE jobs SET title = ?, updated_at = ? WHERE id = ?", (title, now, job_id))
            elif description is not None:
                conn.execute("UPDATE jobs SET description = ?, updated_at = ? WHERE id = ?", (description, now, job_id))
        return self.get_job(job_id)

    def delete_job(self, job_id: str) -> bool:
        with self._connect() as conn:
            res = conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
            return res.rowcount > 0

    # ─────────────────────────────────────────────────────────────
    # Requirements Operations
    # ─────────────────────────────────────────────────────────────

    def set_requirements(self, job_id: str, requirements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        import uuid
        with self._connect() as conn:
            # Delete old requirements
            conn.execute("DELETE FROM requirements WHERE job_id = ?", (job_id,))
            for idx, req in enumerate(requirements):
                req_id = req.get("id") or str(uuid.uuid4())
                category = req.get("category", "must_have")
                if category not in ("must_have", "nice_to_have"):
                    category = "must_have"
                conn.execute(
                    "INSERT INTO requirements (id, job_id, text, category, sort_order) VALUES (?, ?, ?, ?, ?)",
                    (req_id, job_id, req.get("text", "").strip(), category, req.get("sort_order", idx))
                )
            conn.execute(
                "UPDATE jobs SET updated_at = ? WHERE id = ?",
                (datetime.now(timezone.utc).isoformat(), job_id)
            )
        job = self.get_job(job_id)
        return job["requirements"] if job else []

    # ─────────────────────────────────────────────────────────────
    # Candidates Operations
    # ─────────────────────────────────────────────────────────────

    def add_candidate(self, candidate_data: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        c_id = candidate_data["id"]
        with self._connect() as conn:
            conn.execute("""
                INSERT INTO candidates (
                    id, job_id, filename, name, email, phone, skills, education, years_exp,
                    status, notes, fit_score, summary, gaps, must_haves_met, must_haves_total,
                    nice_to_haves_met, nice_to_haves_total, interview_questions, risk_flags,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                c_id,
                candidate_data["job_id"],
                candidate_data["filename"],
                candidate_data.get("name", ""),
                candidate_data.get("email", ""),
                candidate_data.get("phone", ""),
                candidate_data.get("skills", ""),
                candidate_data.get("education", ""),
                candidate_data.get("years_exp", 0.0),
                candidate_data.get("status", "new"),
                candidate_data.get("notes", ""),
                candidate_data.get("fit_score", 0),
                candidate_data.get("summary", ""),
                candidate_data.get("gaps", ""),
                candidate_data.get("must_haves_met", 0),
                candidate_data.get("must_haves_total", 0),
                candidate_data.get("nice_to_haves_met", 0),
                candidate_data.get("nice_to_haves_total", 0),
                json.dumps(candidate_data.get("interview_questions", [])),
                json.dumps(candidate_data.get("risk_flags", [])),
                now,
                now
            ))
        return self.get_candidate(c_id)

    def get_candidate(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
            if not row:
                return None
            cand = dict(row)
            try:
                cand["interview_questions"] = json.loads(cand.get("interview_questions") or "[]")
            except Exception:
                cand["interview_questions"] = []
            try:
                cand["risk_flags"] = json.loads(cand.get("risk_flags") or "[]")
            except Exception:
                cand["risk_flags"] = []

            # Get scores with requirement details
            scores_rows = conn.execute("""
                SELECT s.*, r.text as requirement_text, r.category as requirement_category
                FROM scores s
                JOIN requirements r ON s.requirement_id = r.id
                WHERE s.candidate_id = ?
                ORDER BY r.sort_order ASC, r.id ASC
            """, (candidate_id,)).fetchall()
            cand["requirements"] = [dict(s) for s in scores_rows]
            return cand

    def list_candidates_for_job(
        self,
        job_id: str,
        status: Optional[str] = None,
        min_score: Optional[int] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = "SELECT * FROM candidates WHERE job_id = ?"
        params: List[Any] = [job_id]

        if status:
            query += " AND status = ?"
            params.append(status)
        if min_score is not None:
            query += " AND fit_score >= ?"
            params.append(min_score)

        query += " ORDER BY fit_score DESC, updated_at DESC"

        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
            candidates = []
            for r in rows:
                c = dict(r)
                try:
                    c["interview_questions"] = json.loads(c.get("interview_questions") or "[]")
                except Exception:
                    c["interview_questions"] = []
                try:
                    c["risk_flags"] = json.loads(c.get("risk_flags") or "[]")
                except Exception:
                    c["risk_flags"] = []

                # Attach requirement score breakdown for table chips
                scores_rows = conn.execute("""
                    SELECT s.verdict, r.category, r.text, r.id as requirement_id
                    FROM scores s
                    JOIN requirements r ON s.requirement_id = r.id
                    WHERE s.candidate_id = ?
                    ORDER BY r.sort_order ASC
                """, (c["id"],)).fetchall()
                c["score_breakdown"] = [dict(sr) for sr in scores_rows]

                # If search term provided
                if search:
                    s_lower = search.lower()
                    text_blob = f"{c.get('name', '')} {c.get('skills', '')} {c.get('education', '')} {c.get('filename', '')}".lower()
                    if s_lower not in text_blob:
                        continue

                candidates.append(c)
            return candidates

    def update_candidate_status_notes(
        self,
        candidate_id: str,
        status: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            if status is not None and notes is not None:
                conn.execute(
                    "UPDATE candidates SET status = ?, notes = ?, updated_at = ? WHERE id = ?",
                    (status, notes, now, candidate_id)
                )
            elif status is not None:
                conn.execute(
                    "UPDATE candidates SET status = ?, updated_at = ? WHERE id = ?",
                    (status, now, candidate_id)
                )
            elif notes is not None:
                conn.execute(
                    "UPDATE candidates SET notes = ?, updated_at = ? WHERE id = ?",
                    (notes, now, candidate_id)
                )
        return self.get_candidate(candidate_id)

    def delete_candidate(self, candidate_id: str) -> bool:
        with self._connect() as conn:
            res = conn.execute("DELETE FROM candidates WHERE id = ?", (candidate_id,))
            return res.rowcount > 0

    # ─────────────────────────────────────────────────────────────
    # Scoring Operations
    # ─────────────────────────────────────────────────────────────

    def save_candidate_scores(
        self,
        candidate_id: str,
        fit_score: int,
        summary: str,
        gaps: str,
        must_haves_met: int,
        must_haves_total: int,
        nice_to_haves_met: int,
        nice_to_haves_total: int,
        scores_list: List[Dict[str, Any]],
        interview_questions: Optional[List[str]] = None,
        risk_flags: Optional[List[Dict[str, Any]]] = None
    ):
        import uuid
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            # Update candidate record
            conn.execute("""
                UPDATE candidates SET
                    fit_score = ?,
                    summary = ?,
                    gaps = ?,
                    must_haves_met = ?,
                    must_haves_total = ?,
                    nice_to_haves_met = ?,
                    nice_to_haves_total = ?,
                    interview_questions = ?,
                    risk_flags = ?,
                    updated_at = ?
                WHERE id = ?
            """, (
                fit_score,
                summary,
                gaps,
                must_haves_met,
                must_haves_total,
                nice_to_haves_met,
                nice_to_haves_total,
                json.dumps(interview_questions or []),
                json.dumps(risk_flags or []),
                now,
                candidate_id
            ))

            # Upsert score rows
            for item in scores_list:
                score_id = item.get("id") or str(uuid.uuid4())
                conn.execute("""
                    INSERT INTO scores (
                        id, candidate_id, requirement_id, verdict, evidence_quote, page_number, confidence, reasoning
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(candidate_id, requirement_id) DO UPDATE SET
                        verdict = excluded.verdict,
                        evidence_quote = excluded.evidence_quote,
                        page_number = excluded.page_number,
                        confidence = excluded.confidence,
                        reasoning = excluded.reasoning
                """, (
                    score_id,
                    candidate_id,
                    item["requirement_id"],
                    item.get("verdict", "missing"),
                    item.get("evidence_quote", ""),
                    item.get("page_number", 1),
                    item.get("confidence", "high"),
                    item.get("reasoning", "")
                ))

    def get_comparison_matrix(self, job_id: str, candidate_ids: List[str]) -> Dict[str, Any]:
        """Returns comparison matrix: rows = requirements, columns = candidates, cells = scores."""
        job = self.get_job(job_id)
        if not job:
            return {"error": "Job not found"}

        requirements = job.get("requirements", [])
        candidates = []
        for c_id in candidate_ids:
            cand = self.get_candidate(c_id)
            if cand:
                candidates.append(cand)

        # Build matrix
        matrix = []
        for req in requirements:
            row_data = {
                "requirement_id": req["id"],
                "requirement_text": req["text"],
                "category": req["category"],
                "candidates": {}
            }
            for cand in candidates:
                # Find matching score in candidate.requirements
                score = next((s for s in cand.get("requirements", []) if s["requirement_id"] == req["id"]), None)
                if score:
                    row_data["candidates"][cand["id"]] = {
                        "verdict": score["verdict"],
                        "evidence_quote": score["evidence_quote"],
                        "page_number": score["page_number"],
                        "confidence": score["confidence"]
                    }
                else:
                    row_data["candidates"][cand["id"]] = {
                        "verdict": "missing",
                        "evidence_quote": "No evidence recorded",
                        "page_number": None,
                        "confidence": "low"
                    }
            matrix.append(row_data)

        return {
            "job_id": job_id,
            "job_title": job["title"],
            "candidates": [
                {
                    "id": c["id"],
                    "name": c["name"] or c["filename"],
                    "filename": c["filename"],
                    "fit_score": c["fit_score"],
                    "status": c["status"]
                }
                for c in candidates
            ],
            "requirements": requirements,
            "matrix": matrix
        }


# Singleton database instance
db = TalentScanDB()
