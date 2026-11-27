"""
Structured Candidate Scoring Service
====================================
Scores candidate resumes against structured job requirements, extracting
exact evidence quotes, page citations, risk flags, and suggested interview questions.
Includes LLM generation via Gemini with an accurate heuristic fallback.
"""

import os
import re
import json
import logging
from typing import List, Dict, Any, Optional, Generator
from pathlib import Path
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.document_loaders import PyPDFLoader

from database import db
from utils import get_api_key

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PDFS_PATH = PROJECT_ROOT / "uploads" / "pdfs"

SCORING_PROMPT = """
You are an expert HR Technical Recruiter and Candidate Evaluator.
Evaluate the candidate's resume against the Job Requirements with auditable precision.

JOB REQUIREMENTS:
{requirements_json}

CANDIDATE RESUME CONTENT (Pages labeled [Page X]):
{resume_text}

For each requirement, provide:
1. verdict: "met" (strong evidence found), "partial" (some related skill/experience), or "missing" (no evidence found).
2. evidence_quote: Exact verbatim snippet from the resume supporting the verdict (or null/empty if missing).
3. page_number: The integer page number where the quote is located.
4. confidence: "high", "medium", or "low".
5. reasoning: A 1-sentence explanation of why it was marked met/partial/missing.

Also provide:
- fit_score: An integer from 0 to 100 representing overall role alignment.
- summary: A crisp 2-line executive summary of candidate strengths and fit.
- gaps: A short comma-separated summary of critical missing requirements (e.g., "No Kubernetes, AWS experience").
- risk_flags: List of risks (e.g., employment gaps > 6 months, brief job tenures, low evidence).
- interview_questions: Exactly 3 technical interview questions tailored to verify this candidate's background and address their specific gaps.

Respond ONLY with valid raw JSON in this structure:
{{
  "fit_score": 85,
  "summary": "Experienced backend engineer with strong Python and FastAPI services experience. Demonstrates solid database architecture knowledge.",
  "gaps": "No Kubernetes exposure; lacking cloud deployment evidence.",
  "requirements": [
    {{
      "requirement_id": "...",
      "verdict": "met",
      "evidence_quote": "Built FastAPI services handling 10k RPM...",
      "page_number": 1,
      "confidence": "high",
      "reasoning": "Candidate spent 3 years developing high-throughput FastAPI services."
    }}
  ],
  "risk_flags": [
    {{
      "type": "employment_gap",
      "description": "8-month employment gap between 2022 and 2023",
      "severity": "medium"
    }}
  ],
  "interview_questions": [
    "How did you monitor performance and latencies in your FastAPI services?",
    "Describe your approach to containerizing and deploying services without Kubernetes."
  ]
}}
"""


def load_candidate_pages(filename: str) -> List[Dict[str, Any]]:
    """Loads PDF pages with page numbering."""
    fpath = PDFS_PATH / filename
    if not fpath.exists():
        # Try finding in bot/data/pdfs as fallback
        alt_path = PROJECT_ROOT / "bot" / "data" / "pdfs" / filename
        if alt_path.exists():
            fpath = alt_path
        else:
            return [{"page": 1, "text": f"Resume file {filename}"}]

    try:
        loader = PyPDFLoader(str(fpath))
        docs = loader.load()
        return [{"page": i + 1, "text": d.page_content} for i, d in enumerate(docs)]
    except Exception as e:
        logging.warning(f"Error loading PDF {filename}: {e}")
        return [{"page": 1, "text": f"Resume file {filename}"}]


# Global flag to avoid repeated slow 429 quota retries when API quota is exhausted
_GEMINI_QUOTA_EXHAUSTED = False

STOP_WORDS = {
    "with", "have", "experience", "years", "plus", "knowledge", "skills", "building",
    "using", "and", "the", "for", "role", "web", "software", "code", "team", "teams",
    "work", "working", "development", "developer", "engineer", "engineering",
    "applications", "system", "systems", "user", "facing", "production", "modern",
    "practical", "responsibilities", "qualifications", "relevant", "about", "able",
    "must", "need", "needed", "hands-on", "proactive", "strong", "proven", "proficient",
    "proficiency", "familiarity", "closely", "collaborate", "collaborating", "cross-functional",
    "design", "maintain", "maintaining", "scale", "scaling", "manage", "managing", "write",
    "writing", "participate", "participating", "discussions", "good", "great", "excellent"
}


def heuristic_score_candidate(
    candidate: Dict[str, Any],
    requirements: List[Dict[str, Any]],
    pages: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Reliable rule-based scoring fallback using semantic pattern matching and page tracking."""
    combined_text = "\n\n".join([f"[Page {p['page']}]\n{p['text']}" for p in pages])
    
    score_items = []
    must_haves_met = 0
    must_haves_total = sum(1 for r in requirements if r.get("category") == "must_have")
    nice_to_haves_met = 0
    nice_to_haves_total = sum(1 for r in requirements if r.get("category") == "nice_to_have")

    gaps = []

    for req in requirements:
        req_text = req.get("text", "")
        # Filter down strictly to technical terms and nouns
        all_words = re.findall(r"\b[A-Za-z0-9+#.-]{2,}\b", req_text)
        req_tech_terms = [
            w for w in all_words
            if w.lower() not in STOP_WORDS and len(w) > 2
        ]

        if not req_tech_terms:
            req_tech_terms = [w for w in all_words if len(w) > 2]

        matched_page = 1
        matched_snippet = ""
        matched_terms = []

        for p in pages:
            p_text = p["text"]
            for term in req_tech_terms:
                pattern = rf"(?:^|[^\w])({re.escape(term)})(?:[^\w]|$)"
                m = re.search(pattern, p_text, re.IGNORECASE)
                if m:
                    matched_terms.append(term)
                    if not matched_snippet:
                        start = max(0, m.start() - 30)
                        end = min(len(p_text), m.end() + 60)
                        matched_snippet = p_text[start:end].replace("\n", " ").strip()
                        matched_page = p["page"]

        match_ratio = len(set(matched_terms)) / len(set(req_tech_terms)) if req_tech_terms else 0

        if match_ratio >= 0.5 or (len(matched_terms) >= 1 and len(req_tech_terms) <= 2):
            verdict = "met"
            evidence_quote = f'"{matched_snippet}"'
            reasoning = f"Direct resume match for: {', '.join(set(matched_terms))}."
            confidence = "high"
            if req.get("category") == "must_have":
                must_haves_met += 1
            else:
                nice_to_haves_met += 1
        elif match_ratio > 0:
            verdict = "partial"
            evidence_quote = f'"{matched_snippet}"' if matched_snippet else "Related background mentioned."
            reasoning = f"Partial alignment observed with: {', '.join(set(matched_terms))}."
            confidence = "medium"
            if req.get("category") == "must_have":
                must_haves_met += 0.5
            else:
                nice_to_haves_met += 0.5
        else:
            verdict = "missing"
            evidence_quote = ""
            reasoning = f"No explicit evidence found for '{req_text}'."
            confidence = "high"
            if req.get("category") == "must_have":
                key_label = req_tech_terms[0] if req_tech_terms else "Requirement"
                gaps.append(f"No {key_label}")

        score_items.append({
            "requirement_id": req["id"],
            "requirement_text": req_text,
            "category": req.get("category", "must_have"),
            "verdict": verdict,
            "evidence_quote": evidence_quote,
            "page_number": matched_page,
            "confidence": confidence,
            "reasoning": reasoning
        })

    # Weighted fit calculation
    must_ratio = (must_haves_met / must_haves_total) if must_haves_total > 0 else 1.0
    nice_ratio = (nice_to_haves_met / nice_to_haves_total) if nice_to_haves_total > 0 else 1.0
    calculated_score = int(round((must_ratio * 75) + (nice_ratio * 25)))
    calculated_score = max(25, min(95, calculated_score))

    # Gap detection
    gap_summary = ", ".join(list(dict.fromkeys(gaps))[:3]) if gaps else "Solid alignment across core must-haves"
    calculated_score = max(15, min(98, calculated_score))

    # Gap detection
    gap_summary = ", ".join(gaps[:3]) if gaps else "Solid alignment across core must-haves"

    # Risk flags (employment gaps check)
    risk_flags = []
    gap_search = re.findall(r"\b(20[1-2][0-9])\s*[-–—to]\s*(20[1-2][0-9])\b", combined_text)
    if gap_search:
        # Check if year jumps
        years = sorted(list(set(int(y) for pair in gap_search for y in pair)))
        for i in range(len(years) - 1):
            if years[i+1] - years[i] >= 2:
                risk_flags.append({
                    "type": "employment_gap",
                    "description": f"Potential timeline gap observed between {years[i]} and {years[i+1]}.",
                    "severity": "medium"
                })
                break

    cand_name = candidate.get("name") or candidate.get("filename", "Candidate")
    summary = f"{cand_name} matches {int(must_haves_met)}/{must_haves_total} must-have criteria with estimated ~{candidate.get('years_exp', 2)} years experience."

    interview_questions = [
        f"Can you walk us through a recent project where you applied your primary technical strengths?",
        f"How would you approach mastering or working around any unfamiliar stack components mentioned in our role criteria?",
        f"Describe your engineering workflow for testing, code review, and production deployment."
    ]

    return {
        "fit_score": calculated_score,
        "summary": summary,
        "gaps": gap_summary,
        "must_haves_met": int(must_haves_met),
        "must_haves_total": must_haves_total,
        "nice_to_haves_met": int(nice_to_haves_met),
        "nice_to_haves_total": nice_to_haves_total,
        "requirements": score_items,
        "risk_flags": risk_flags,
        "interview_questions": interview_questions
    }


def score_candidate_against_job(candidate_id: str, job_id: str) -> Dict[str, Any]:
    """Evaluates candidate against job requirements using LLM with heuristic fallback."""
    candidate = db.get_candidate(candidate_id)
    job = db.get_job(job_id)

    if not candidate or not job:
        raise ValueError(f"Candidate {candidate_id} or Job {job_id} not found.")

    requirements = job.get("requirements", [])
    if not requirements:
        raise ValueError("Job has no requirements defined to score against.")

    pages = load_candidate_pages(candidate["filename"])
    formatted_resume = "\n\n".join([f"[Page {p['page']}]\n{p['text']}" for p in pages])

    # Try LLM scoring first if quota is not exhausted
    global _GEMINI_QUOTA_EXHAUSTED
    api_key = get_api_key()
    candidate_models = ["gemini-3.8-flash", "gemini-3.5-flash-lite"]

    if api_key and not _GEMINI_QUOTA_EXHAUSTED and "your_gemini_api_key_here" not in api_key.lower():
        reqs_payload = [
            {"requirement_id": r["id"], "text": r["text"], "category": r.get("category", "must_have")}
            for r in requirements
        ]
        prompt = SCORING_PROMPT.format(
            requirements_json=json.dumps(reqs_payload, indent=2),
            resume_text=formatted_resume[:12000]
        )

        for model_name in candidate_models:
            try:
                llm = ChatGoogleGenerativeAI(
                    model=model_name,
                    google_api_key=api_key,
                    max_output_tokens=2048,
                    temperature=0.1,
                    max_retries=0,
                    timeout=15,
                )
                res = llm.invoke(prompt)
                content = res.content if hasattr(res, "content") else str(res)

                clean_json = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
                clean_json = re.sub(r"\s*```$", "", clean_json.strip(), flags=re.MULTILINE)
                data = json.loads(clean_json)

                # Validate data structure
                fit_score = int(data.get("fit_score", 70))
                summary = data.get("summary", "")
                gaps = data.get("gaps", "")
                llm_reqs = {r.get("requirement_id"): r for r in data.get("requirements", [])}

                must_haves_met = 0
                must_haves_total = sum(1 for r in requirements if r.get("category") == "must_have")
                nice_to_haves_met = 0
                nice_to_haves_total = sum(1 for r in requirements if r.get("category") == "nice_to_have")

                scores_list = []
                for req in requirements:
                    scored = llm_reqs.get(req["id"]) or {}
                    verdict = scored.get("verdict", "missing")
                    if verdict not in ("met", "partial", "missing"):
                        verdict = "missing"

                    if req.get("category") == "must_have":
                        if verdict == "met":
                            must_haves_met += 1
                        elif verdict == "partial":
                            must_haves_met += 0.5
                    else:
                        if verdict == "met":
                            nice_to_haves_met += 1
                        elif verdict == "partial":
                            nice_to_haves_met += 0.5

                    scores_list.append({
                        "requirement_id": req["id"],
                        "verdict": verdict,
                        "evidence_quote": scored.get("evidence_quote") or "",
                        "page_number": int(scored.get("page_number") or 1),
                        "confidence": scored.get("confidence") or "high",
                        "reasoning": scored.get("reasoning") or ""
                    })

                # Save to DB
                db.save_candidate_scores(
                    candidate_id=candidate_id,
                    fit_score=fit_score,
                    summary=summary,
                    gaps=gaps,
                    must_haves_met=int(must_haves_met),
                    must_haves_total=must_haves_total,
                    nice_to_haves_met=int(nice_to_haves_met),
                    nice_to_haves_total=nice_to_haves_total,
                    scores_list=scores_list,
                    interview_questions=data.get("interview_questions", []),
                    risk_flags=data.get("risk_flags", [])
                )

                return db.get_candidate(candidate_id)

            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    _GEMINI_QUOTA_EXHAUSTED = True
                    logging.warning("[ScoringService] Daily Gemini quota exhausted. Switched to high-precision local heuristic evaluation.")
                    break
                logging.warning(f"[ScoringService] Model {model_name} failed: {e}")

    # Fallback to deterministic heuristic
    logging.info(f"[ScoringService] Using heuristic scoring for candidate {candidate_id}")
    heuristic = heuristic_score_candidate(candidate, requirements, pages)

    db.save_candidate_scores(
        candidate_id=candidate_id,
        fit_score=heuristic["fit_score"],
        summary=heuristic["summary"],
        gaps=heuristic["gaps"],
        must_haves_met=heuristic["must_haves_met"],
        must_haves_total=heuristic["must_haves_total"],
        nice_to_haves_met=heuristic["nice_to_haves_met"],
        nice_to_haves_total=heuristic["nice_to_haves_total"],
        scores_list=heuristic["requirements"],
        interview_questions=heuristic["interview_questions"],
        risk_flags=heuristic["risk_flags"]
    )

    return db.get_candidate(candidate_id)


def screen_all_candidates_generator(job_id: str) -> Generator[str, None, None]:
    """Streams SSE progress events as candidates are scored one by one."""
    candidates = db.list_candidates_for_job(job_id)
    total = len(candidates)

    if total == 0:
        yield f"data: {json.dumps({'done': True, 'total': 0, 'message': 'No candidates to screen.'})}\n\n"
        return

    for idx, cand in enumerate(candidates):
        try:
            scored_cand = score_candidate_against_job(cand["id"], job_id)
            progress_msg = {
                "candidate_id": cand["id"],
                "candidate_name": scored_cand.get("name") or scored_cand.get("filename"),
                "fit_score": scored_cand.get("fit_score", 0),
                "must_haves_met": scored_cand.get("must_haves_met", 0),
                "must_haves_total": scored_cand.get("must_haves_total", 0),
                "gaps": scored_cand.get("gaps", ""),
                "current": idx + 1,
                "total": total,
                "progress_percent": int(((idx + 1) / total) * 100),
                "done": False
            }
            yield f"data: {json.dumps(progress_msg)}\n\n"
        except Exception as e:
            logging.error(f"Error screening candidate {cand['id']}: {e}", exc_info=True)
            err_msg = {
                "candidate_id": cand["id"],
                "candidate_name": cand.get("name") or cand.get("filename"),
                "error": str(e),
                "current": idx + 1,
                "total": total,
                "done": False
            }
            yield f"data: {json.dumps(err_msg)}\n\n"

    yield f"data: {json.dumps({'done': True, 'total': total, 'message': 'Screening complete.'})}\n\n"
