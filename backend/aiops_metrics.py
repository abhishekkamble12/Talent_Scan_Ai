"""
AIOps Metrics Collector for TalentScan AI
==========================================
Logs latency, retrieval quality, LLM evaluation scores, and usage
stats into a local SQLite database for monitoring and dashboarding.
"""

import sqlite3
import time
import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any

DB_PATH = Path(os.getenv("AIOPS_DB_PATH", str(Path(__file__).resolve().parent.parent / "aiops_metrics.db")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


@dataclass
class QueryMetrics:
    """All metrics collected for a single RAG query."""
    # Identifiers
    query_id: str = ""
    timestamp: str = ""
    question: str = ""
    
    # Latency (milliseconds)
    embedding_latency_ms: float = 0.0
    retrieval_latency_ms: float = 0.0
    llm_latency_ms: float = 0.0
    evaluation_latency_ms: float = 0.0
    total_e2e_latency_ms: float = 0.0
    
    # Retrieval Quality
    chunks_retrieved: int = 0
    avg_similarity_score: float = 0.0
    min_similarity_score: float = 0.0
    max_similarity_score: float = 0.0
    unique_sources: int = 0
    context_length_chars: int = 0
    
    # LLM Info
    model_used: str = ""
    model_fallback_count: int = 0
    response_length_chars: int = 0
    estimated_input_tokens: int = 0
    estimated_output_tokens: int = 0
    
    # Evaluation Scores (1-5)
    answer_relevance: float = 0.0
    groundedness: float = 0.0
    coherence: float = 0.0
    completeness: float = 0.0
    hallucination_risk: float = 0.0
    eval_reasoning: str = ""
    
    # Status
    status: str = "success"  # success | error | timeout
    error_message: str = ""
    
    # Cost
    estimated_cost_usd: float = 0.0


class MetricsStore:
    """SQLite-backed metrics storage."""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or str(DB_PATH)
        self._init_db()
    
    def _init_db(self):
        with self._connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS query_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    question TEXT,
                    embedding_latency_ms REAL DEFAULT 0,
                    retrieval_latency_ms REAL DEFAULT 0,
                    llm_latency_ms REAL DEFAULT 0,
                    evaluation_latency_ms REAL DEFAULT 0,
                    total_e2e_latency_ms REAL DEFAULT 0,
                    chunks_retrieved INTEGER DEFAULT 0,
                    avg_similarity_score REAL DEFAULT 0,
                    min_similarity_score REAL DEFAULT 0,
                    max_similarity_score REAL DEFAULT 0,
                    unique_sources INTEGER DEFAULT 0,
                    context_length_chars INTEGER DEFAULT 0,
                    model_used TEXT DEFAULT '',
                    model_fallback_count INTEGER DEFAULT 0,
                    response_length_chars INTEGER DEFAULT 0,
                    estimated_input_tokens INTEGER DEFAULT 0,
                    estimated_output_tokens INTEGER DEFAULT 0,
                    answer_relevance REAL DEFAULT 0,
                    groundedness REAL DEFAULT 0,
                    coherence REAL DEFAULT 0,
                    completeness REAL DEFAULT 0,
                    hallucination_risk REAL DEFAULT 0,
                    eval_reasoning TEXT DEFAULT '',
                    status TEXT DEFAULT 'success',
                    error_message TEXT DEFAULT '',
                    estimated_cost_usd REAL DEFAULT 0
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS pipeline_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    documents_loaded INTEGER DEFAULT 0,
                    chunks_created INTEGER DEFAULT 0,
                    chunks_added INTEGER DEFAULT 0,
                    pipeline_latency_ms REAL DEFAULT 0,
                    status TEXT DEFAULT 'success',
                    error_message TEXT DEFAULT ''
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS candidate_profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT UNIQUE NOT NULL,
                    candidate_name TEXT DEFAULT '',
                    top_skills TEXT DEFAULT '',
                    estimated_years_exp REAL DEFAULT 0,
                    education TEXT DEFAULT '',
                    summary TEXT DEFAULT '',
                    created_at TEXT NOT NULL
                )
            """)
            # Schema migration check: ensure eval_reasoning exists
            try:
                conn.execute("ALTER TABLE query_metrics ADD COLUMN eval_reasoning TEXT DEFAULT ''")
            except sqlite3.OperationalError:
                pass  # Column already exists
            conn.commit()
    
    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def log_query(self, metrics: QueryMetrics):
        """Insert a query metrics record or update by query_id if already exists."""
        d = asdict(metrics)
        with self._connect() as conn:
            existing = conn.execute("SELECT id FROM query_metrics WHERE query_id = ?", [metrics.query_id]).fetchone()
            if existing:
                set_clauses = ", ".join([f"{k} = ?" for k in d.keys()])
                values = list(d.values()) + [metrics.query_id]
                conn.execute(f"UPDATE query_metrics SET {set_clauses} WHERE query_id = ?", values)
            else:
                cols = ", ".join(d.keys())
                placeholders = ", ".join(["?"] * len(d))
                conn.execute(f"INSERT INTO query_metrics ({cols}) VALUES ({placeholders})", list(d.values()))
            conn.commit()
        logging.info(f"[AIOps] Logged metrics for query_id={metrics.query_id}")

    def update_evaluation(self, query_id: str, scores: Dict[str, Any]):
        """Update evaluation metrics for an existing query asynchronously."""
        with self._connect() as conn:
            conn.execute("""
                UPDATE query_metrics 
                SET answer_relevance = ?,
                    groundedness = ?,
                    coherence = ?,
                    completeness = ?,
                    hallucination_risk = ?,
                    eval_reasoning = ?
                WHERE query_id = ?
            """, [
                scores.get("answer_relevance", 0.0),
                scores.get("groundedness", 0.0),
                scores.get("coherence", 0.0),
                scores.get("completeness", 0.0),
                scores.get("hallucination_risk", 0.0),
                str(scores.get("eval_reasoning", "")),
                query_id
            ])
            conn.commit()
        logging.info(f"[AIOps] Updated evaluation scores for query_id={query_id}: {scores}")

    def log_pipeline_run(self, docs_loaded: int, chunks_created: int, chunks_added: int, 
                         latency_ms: float, status: str = "success", error: str = ""):
        with self._connect() as conn:
            conn.execute("""
                INSERT INTO pipeline_runs (timestamp, documents_loaded, chunks_created, chunks_added, 
                                           pipeline_latency_ms, status, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [datetime.now(timezone.utc).isoformat(), docs_loaded, chunks_created, 
                  chunks_added, latency_ms, status, error])
            conn.commit()
    
    def get_summary(self, last_n: int = 100) -> Dict[str, Any]:
        """Return aggregate metrics for the dashboard."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM query_metrics ORDER BY id DESC LIMIT ?", [last_n]
            ).fetchall()
            
            pipeline_runs = conn.execute(
                "SELECT * FROM pipeline_runs ORDER BY id DESC LIMIT 10"
            ).fetchall()
            
            if not rows:
                return {
                    "total_queries": 0,
                    "success_rate": 100,
                    "error_rate": 0,
                    "avg_e2e_latency_ms": 0,
                    "avg_embedding_latency_ms": 0,
                    "avg_retrieval_latency_ms": 0,
                    "avg_llm_latency_ms": 0,
                    "p50_latency_ms": 0,
                    "p95_latency_ms": 0,
                    "p99_latency_ms": 0,
                    "avg_similarity_score": 0,
                    "avg_chunks_retrieved": 0,
                    "avg_unique_sources": 0,
                    "avg_answer_relevance": 0,
                    "avg_groundedness": 0,
                    "avg_coherence": 0,
                    "avg_completeness": 0,
                    "avg_hallucination_risk": 0,
                    "model_distribution": {},
                    "total_fallbacks": 0,
                    "avg_response_length": 0,
                    "total_estimated_cost_usd": 0,
                    "avg_cost_per_query_usd": 0,
                    "recent_avg_latency_ms": 0,
                    "recent_avg_relevance": 0,
                    "pipeline_runs": [dict(r) for r in pipeline_runs],
                    "message": "No queries logged yet."
                }
            
            total = len(rows)
            successes = sum(1 for r in rows if r["status"] == "success")
            
            def avg(col):
                vals = [r[col] for r in rows if r[col] is not None and r[col] > 0]
                return round(sum(vals) / len(vals), 2) if vals else 0
            
            # Model usage distribution
            model_counts = {}
            for r in rows:
                m = r["model_used"] or "unknown"
                model_counts[m] = model_counts.get(m, 0) + 1
            
            # Latency percentiles
            e2e_latencies = sorted([r["total_e2e_latency_ms"] for r in rows if r["total_e2e_latency_ms"] and r["total_e2e_latency_ms"] > 0])
            p50 = e2e_latencies[len(e2e_latencies) // 2] if e2e_latencies else 0
            p95 = e2e_latencies[min(int(len(e2e_latencies) * 0.95), len(e2e_latencies) - 1)] if e2e_latencies else 0
            p99 = e2e_latencies[min(int(len(e2e_latencies) * 0.99), len(e2e_latencies) - 1)] if e2e_latencies else 0
            
            # Recent trend (last 10 queries)
            recent_10 = rows[:10]
            recent_avg_latency = round(sum(r["total_e2e_latency_ms"] for r in recent_10) / len(recent_10), 1) if recent_10 else 0
            eval_rows = [r["answer_relevance"] for r in recent_10 if r["answer_relevance"] and r["answer_relevance"] > 0]
            recent_avg_relevance = round(sum(eval_rows) / len(eval_rows), 2) if eval_rows else 0
            
            return {
                "total_queries": total,
                "success_rate": round(successes / total * 100, 1),
                "error_rate": round((total - successes) / total * 100, 1),
                # Latency
                "avg_e2e_latency_ms": avg("total_e2e_latency_ms"),
                "avg_embedding_latency_ms": avg("embedding_latency_ms"),
                "avg_retrieval_latency_ms": avg("retrieval_latency_ms"),
                "avg_llm_latency_ms": avg("llm_latency_ms"),
                "p50_latency_ms": round(p50, 1),
                "p95_latency_ms": round(p95, 1),
                "p99_latency_ms": round(p99, 1),
                # Retrieval Quality
                "avg_similarity_score": avg("avg_similarity_score"),
                "avg_chunks_retrieved": avg("chunks_retrieved"),
                "avg_unique_sources": avg("unique_sources"),
                # LLM Evaluation
                "avg_answer_relevance": avg("answer_relevance"),
                "avg_groundedness": avg("groundedness"),
                "avg_coherence": avg("coherence"),
                "avg_completeness": avg("completeness"),
                "avg_hallucination_risk": avg("hallucination_risk"),
                # Usage
                "model_distribution": model_counts,
                "total_fallbacks": sum(r["model_fallback_count"] or 0 for r in rows),
                "avg_response_length": avg("response_length_chars"),
                # Cost
                "total_estimated_cost_usd": round(sum(r["estimated_cost_usd"] or 0 for r in rows), 5),
                "avg_cost_per_query_usd": round((sum(r["estimated_cost_usd"] or 0 for r in rows) / total) if total else 0, 6),
                # Trends
                "recent_avg_latency_ms": recent_avg_latency,
                "recent_avg_relevance": recent_avg_relevance,
                "pipeline_runs": [dict(r) for r in pipeline_runs],
            }
    
    def get_recent_queries(self, limit: int = 20) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM query_metrics ORDER BY id DESC LIMIT ?", [limit]
            ).fetchall()
            return [dict(r) for r in rows]
    
    def get_latency_timeseries(self, limit: int = 50) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute("""
                SELECT id, query_id, timestamp, total_e2e_latency_ms, embedding_latency_ms, 
                       retrieval_latency_ms, llm_latency_ms, model_used
                FROM query_metrics ORDER BY id DESC LIMIT ?
            """, [limit]).fetchall()
            return [dict(r) for r in reversed(rows)]
    
    def get_evaluation_timeseries(self, limit: int = 50) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute("""
                SELECT id, query_id, timestamp, answer_relevance, groundedness, coherence, 
                       completeness, hallucination_risk
                FROM query_metrics ORDER BY id DESC LIMIT ?
            """, [limit]).fetchall()
            return [dict(r) for r in reversed(rows)]

    # ── Candidate Profile Storage ──
    def upsert_candidate_profile(self, filename: str, candidate_name: str, top_skills: str,
                                 estimated_years_exp: float, education: str, summary: str):
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute("""
                INSERT INTO candidate_profiles (filename, candidate_name, top_skills, estimated_years_exp, education, summary, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(filename) DO UPDATE SET
                    candidate_name = excluded.candidate_name,
                    top_skills = excluded.top_skills,
                    estimated_years_exp = excluded.estimated_years_exp,
                    education = excluded.education,
                    summary = excluded.summary,
                    created_at = excluded.created_at
            """, [filename, candidate_name, top_skills, estimated_years_exp, education, summary, now])
            conn.commit()

    def get_all_candidate_profiles(self) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM candidate_profiles ORDER BY candidate_name ASC, filename ASC").fetchall()
            return [dict(r) for r in rows]

    def delete_candidate_profile(self, filename: str):
        with self._connect() as conn:
            conn.execute("DELETE FROM candidate_profiles WHERE filename = ?", [filename])
            conn.commit()

    def clear_candidate_profiles(self):
        with self._connect() as conn:
            conn.execute("DELETE FROM candidate_profiles")
            conn.commit()


# Global singleton instance
metrics_store = MetricsStore()
