"""
Candidate Profile Extractor
===========================
Extracts structured resume metadata (candidate name, skills, experience, education)
from PDF document pages using regex and taxonomy matching.
"""

import re
from pathlib import Path
from typing import List, Dict, Any


SKILL_PATTERNS = [
    # Languages
    r"\bPython\b", r"\bJavaScript\b", r"\bTypeScript\b", r"\bJava\b", r"\bGo\b", r"\bGolang\b",
    r"\bC\+\+\b", r"\bC#\b", r"\bRuby\b", r"\bRust\b", r"\bSQL\b", r"\bHTML5?\b", r"\bCSS3?\b",
    # Frontend
    r"\bReact(?:\.js)?\b", r"\bNext(?:\.js)?\b", r"\bVue(?:\.js)?\b", r"\bTailwind(?:CSS)?\b",
    r"\bRedux\b", r"\bWebpack\b", r"\bVite\b",
    # Backend & Cloud
    r"\bFastAPI\b", r"\bFlask\b", r"\bDjango\b", r"\bNode(?:\.js)?\b", r"\bExpress(?:\.js)?\b",
    r"\bPostgreSQL\b", r"\bPostgres\b", r"\bMySQL\b", r"\bMongoDB\b", r"\bRedis\b", r"\bSQLite\b",
    r"\bDocker\b", r"\bKubernetes\b", r"\bAWS\b", r"\bGCP\b", r"\bAzure\b", r"\bCI/CD\b", r"\bGit\b",
    # AI / ML / RAG
    r"\bChromaDB\b", r"\bLangChain\b", r"\bLlamaIndex\b", r"\bRAG\b", r"\bOpenAI\b", r"\bGemini\b",
    r"\bPyTorch\b", r"\bTensorFlow\b", r"\bHugging\s*Face\b", r"\bNLP\b", r"\bMachine Learning\b"
]

DEGREE_PATTERNS = [
    r"(?:Bachelor(?:'s)?|B\.?S\.?|B\.?Tech|B\.?E\.?)\s*(?:of|in)?\s*(?:Computer Science|Software Engineering|Information Technology|Engineering|Science|[A-Za-z\s]+)?",
    r"(?:Master(?:'s)?|M\.?S\.?|M\.?Tech|M\.?E\.?|MBA)\s*(?:of|in)?\s*(?:Computer Science|Software Engineering|Data Science|Engineering|[A-Za-z\s]+)?",
    r"(?:Ph\.?D|Doctorate)\s*(?:in)?\s*(?:Computer Science|Machine Learning|[A-Za-z\s]+)?"
]


def extract_candidate_name_from_text(text: str, filename: str) -> str:
    """Infers candidate full real name from header, contact lines, email, or filename."""
    DISALLOWED_KEYWORDS = {
        "resume", "curriculum", "vitae", "summary", "profile", "contact",
        "developer", "devloper", "engineer", "phone", "email", "github",
        "linkedin", "portfolio", "experience", "education", "skills",
        "projects", "objective", "certifications", "candidate", "candidat",
        "page", "details", "technical", "languages", "frameworks", "tools"
    }

    lines = [line.strip() for line in text.split("\n") if line.strip()]

    # Priority 1: Check lines[:5]. If a line has 2-4 words that look like a person's name
    for line in lines[:5]:
        cleaned_line = re.sub(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", "", line)
        cleaned_line = re.sub(r"https?://\S+|www\.\S+|github\.com/\S+|linkedin\.com/\S+", "", cleaned_line, flags=re.IGNORECASE)
        cleaned_line = re.sub(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}", "", cleaned_line)
        cleaned_line = re.sub(r"[|•·*~/\\()<>:;,]", " ", cleaned_line)
        cleaned_line = re.sub(r"[^A-Za-z\s.'-]", " ", cleaned_line).strip()

        words = [w for w in cleaned_line.split() if len(w) >= 2]
        if 2 <= len(words) <= 4:
            if not any(w.lower() in DISALLOWED_KEYWORDS for w in words):
                return " ".join(words).title()

    # Priority 2: Split First Name / Last Name across line 0 and line 1
    if len(lines) >= 2:
        l0_words = re.sub(r"[^A-Za-z\s]", "", lines[0]).strip().split()
        l1_words = re.sub(r"[^A-Za-z\s]", "", lines[1]).strip().split()
        if len(l0_words) == 1 and len(l1_words) == 1:
            w0, w1 = l0_words[0], l1_words[0]
            if len(w0) >= 2 and len(w1) >= 2:
                if w0.lower() not in DISALLOWED_KEYWORDS and w1.lower() not in DISALLOWED_KEYWORDS:
                    return f"{w0.title()} {w1.title()}"

    # Priority 3: Extract from email if present (e.g. choudhari.piyush@gmail.com -> Piyush Choudhari)
    email_match = re.search(r"([a-zA-Z0-9_.+-]+)@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
    if email_match:
        local_part = email_match.group(1).lower()
        local_part = re.sub(r"\d+", "", local_part)
        parts = re.split(r"[._-]", local_part)
        clean_parts = [p.title() for p in parts if len(p) >= 3 and p.lower() not in DISALLOWED_KEYWORDS]
        if len(clean_parts) >= 2:
            return " ".join(clean_parts[:2])

    # Priority 4: Clean filename if not generic
    base = Path(filename).stem
    cleaned = re.sub(r"[-_](?:resume|cv|profile|candidat|candidate)?", " ", base, flags=re.IGNORECASE)
    cleaned = re.sub(r"(?:resume|cv|profile|candidat|candidate)[-_]?", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[^A-Za-z\s]", " ", cleaned).strip()
    words = [w.title() for w in cleaned.split() if w.lower() not in DISALLOWED_KEYWORDS and len(w) >= 2]
    if len(words) >= 2:
        return " ".join(words)
    elif len(words) == 1:
        return words[0]

    return "Candidate"


def extract_skills_from_text(text: str) -> List[str]:
    """Finds all taxonomy skills mentioned in resume text."""
    found = set()
    for pattern in SKILL_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            found.add(match.group(0).strip())
    return sorted(found)


def extract_years_experience(text: str) -> float:
    """Estimates years of professional experience from text patterns."""
    # Pattern: "X+ years of experience"
    exp_matches = re.findall(r"(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s*(?:of)?\s*(?:professional|software|hands-on)?\s*experience)?", text, re.IGNORECASE)
    if exp_matches:
        years = [float(y) for y in exp_matches if 0 < float(y) <= 40]
        if years:
            return max(years)

    # Pattern: 4-digit year ranges like "2019 - 2024" or "2020 - Present"
    ranges = re.findall(r"\b(20[0-2][0-9])\s*[-–—to]\s*(20[0-2][0-9]|present|current)\b", text, re.IGNORECASE)
    if ranges:
        current_year = 2026
        min_year = 3000
        for start, end in ranges:
            start_yr = int(start)
            end_yr = current_year if end.lower() in ["present", "current"] else int(end)
            if start_yr < min_year:
                min_year = start_yr
        if min_year <= current_year:
            return float(min(30, current_year - min_year))

    return 2.0  # default sensible estimate


def extract_education(text: str) -> str:
    """Extracts degree and major from resume text."""
    for pattern in DEGREE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            deg = match.group(0).strip()
            # Clean up trailing punctuation
            return re.sub(r"\s+", " ", deg).strip(",. ")
    return "Bachelor of Science"


def extract_profile_from_pages(filename: str, page_texts: List[str]) -> Dict[str, Any]:
    """Extracts full structured profile from all pages of a resume."""
    combined_text = "\n\n".join(page_texts)
    name = extract_candidate_name_from_text(page_texts[0] if page_texts else combined_text, filename)
    skills = extract_skills_from_text(combined_text)
    years = extract_years_experience(combined_text)
    education = extract_education(combined_text)

    # Short summary snippet
    first_page = page_texts[0] if page_texts else combined_text
    summary_match = re.search(r"(?:Summary|Profile|About Me|Objective)[:\s]+(.*?)(?:\n\s*\n|Experience|Skills|Education)", first_page, re.IGNORECASE | re.DOTALL)
    if summary_match:
        summary = re.sub(r"\s+", " ", summary_match.group(1)).strip()[:240]
    else:
        summary = f"{name} is an experienced professional with skills in {', '.join(skills[:4])}."

    return {
        "filename": Path(filename).name,
        "candidate_name": name,
        "top_skills": ", ".join(skills[:8]),
        "estimated_years_exp": years,
        "education": education,
        "summary": summary,
    }
