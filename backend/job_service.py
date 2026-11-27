"""
Job & Requirements Service
==========================
Handles parsing Job Descriptions into structured requirements (Must-Haves and Nice-to-Haves)
using Gemini LLM with a reliable heuristic fallback.
"""

import os
import re
import json
import uuid
import logging
from typing import List, Dict, Any, Tuple, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from database import db
from utils import get_api_key

EXTRACTION_PROMPT = """
You are an expert HR Technical Recruiter and Job Analyst.
Analyze the following Job Description and extract:
1. The concise Job Title (e.g. "Senior Full Stack Engineer").
2. 5 to 10 key technical and role requirements, categorized as either "must_have" (critical qualifications, core skills, minimum experience) or "nice_to_have" (bonus skills, preferred qualifications).

Job Description:
{job_description}

Respond ONLY with valid, raw JSON matching this exact structure:
{{
  "title": "Extracted Job Title",
  "requirements": [
    {{
      "text": "Specific requirement text, e.g. 5+ years Python backend experience",
      "category": "must_have"
    }},
    {{
      "text": "Specific requirement text, e.g. Experience with Docker and Kubernetes",
      "category": "must_have"
    }},
    {{
      "text": "Specific requirement text, e.g. Familiarity with React or TypeScript",
      "category": "nice_to_have"
    }}
  ]
}}
"""


def fallback_extract_requirements(text: str) -> Tuple[str, List[Dict[str, Any]]]:
    """Robust heuristic extraction when LLM is unavailable or offline."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    
    # 1. Infer Title from first 1-2 lines
    title = "Software Engineer"
    for line in lines[:3]:
        clean = re.sub(r"[#*]", "", line).strip()
        if clean and len(clean.split()) <= 7 and not clean.lower().startswith(("about", "we are", "job description")):
            title = clean
            break

    # 2. Extract bullet points or sentences under requirements/qualifications
    requirements = []
    current_category = "must_have"

    for line in lines:
        l_lower = line.lower()
        if any(h in l_lower for h in ["preferred", "nice to have", "bonus", "plus", "desirable"]):
            current_category = "nice_to_have"
        elif any(h in l_lower for h in ["qualifications", "responsibilities", "requirements", "must have", "what you need"]):
            current_category = "must_have"

        # Check for bullet point
        bullet_match = re.match(r"^[-*•\d.]+\s*(.+)$", line)
        if bullet_match:
            item_text = bullet_match.group(1).strip()
            if len(item_text) > 10 and not item_text.endswith(":"):
                requirements.append({
                    "text": item_text,
                    "category": current_category
                })

    # If no bullets found, split into meaningful chunks
    if not requirements:
        common_tech = ["Python", "JavaScript", "TypeScript", "React", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS", "CI/CD", "Git"]
        found_tech = [t for t in common_tech if re.search(rf"\b{t}\b", text, re.IGNORECASE)]
        for t in found_tech[:6]:
            requirements.append({
                "text": f"Hands-on proficiency with {t}",
                "category": "must_have"
            })
        for t in found_tech[6:]:
            requirements.append({
                "text": f"Experience or familiarity with {t}",
                "category": "nice_to_have"
            })

    # If still empty, supply sensible defaults
    if not requirements:
        requirements = [
            {"text": "Relevant software engineering experience", "category": "must_have"},
            {"text": "Strong problem-solving and algorithmic skills", "category": "must_have"},
            {"text": "Familiarity with modern web frameworks and databases", "category": "must_have"},
            {"text": "Collaborative communication and team-player mindset", "category": "nice_to_have"},
        ]

    return title, requirements[:12]


def extract_requirements_from_jd(description: str) -> Tuple[str, List[Dict[str, Any]]]:
    """Uses Gemini LLM to extract title and requirements, falling back to heuristics."""
    api_key = get_api_key()
    if not api_key or "your_gemini_api_key_here" in api_key.lower():
        logging.info("[JobService] No API key; using heuristic extraction.")
        return fallback_extract_requirements(description)

    candidate_models = ["gemini-3.8-flash", "gemini-3.5-flash-lite"]
    prompt = EXTRACTION_PROMPT.format(job_description=description[:4000])

    for model_name in candidate_models:
        try:
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=api_key,
                max_output_tokens=1024,
                temperature=0.2,
                timeout=8,
            )
            res = llm.invoke(prompt)
            content = res.content if hasattr(res, "content") else str(res)
            
            # Clean markdown codeblocks
            clean_json = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
            clean_json = re.sub(r"\s*```$", "", clean_json.strip(), flags=re.MULTILINE)

            data = json.loads(clean_json)
            title = data.get("title", "").strip() or "Software Engineer"
            reqs = data.get("requirements", [])
            
            cleaned_reqs = []
            for r in reqs:
                if isinstance(r, dict) and r.get("text"):
                    cat = "nice_to_have" if r.get("category") == "nice_to_have" else "must_have"
                    cleaned_reqs.append({"text": r["text"].strip(), "category": cat})

            if cleaned_reqs:
                return title, cleaned_reqs[:12]

        except Exception as e:
            logging.warning(f"[JobService] Model {model_name} extraction failed: {e}")

    # Fallback if LLM parsing failed
    logging.info("[JobService] Falling back to heuristic extraction.")
    return fallback_extract_requirements(description)


def create_job_with_requirements(description: str, title: Optional[str] = None) -> Dict[str, Any]:
    """High-level function: extracts requirements, creates job and requirements in DB."""
    extracted_title, requirements = extract_requirements_from_jd(description)
    final_title = title.strip() if (title and title.strip()) else extracted_title

    job_id = str(uuid.uuid4())
    job = db.create_job(job_id=job_id, title=final_title, description=description)

    # Format requirements with UUIDs and sort order
    formatted_reqs = []
    for idx, r in enumerate(requirements):
        formatted_reqs.append({
            "id": str(uuid.uuid4()),
            "text": r["text"],
            "category": r.get("category", "must_have"),
            "sort_order": idx
        })

    saved_reqs = db.set_requirements(job_id, formatted_reqs)
    job["requirements"] = saved_reqs
    return job
