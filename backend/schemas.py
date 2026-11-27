"""
Pydantic Schemas for TalentScan AI
==================================
Strict data contracts for Jobs, Requirement Chips, Candidate Scoring,
Evidence Citations, and Comparison Matrix.
"""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class RequirementChip(BaseModel):
    id: Optional[str] = None
    text: str = Field(..., description="Requirement description, e.g. '5+ years Python backend'")
    category: str = Field("must_have", description="'must_have' or 'nice_to_have'")
    sort_order: int = 0


class JobCreate(BaseModel):
    title: Optional[str] = Field(None, description="Optional job title (auto-extracted from JD if omitted)")
    description: str = Field(..., description="Full text of the job description")
    requirements: Optional[List[RequirementChip]] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class RequirementsUpdate(BaseModel):
    requirements: List[RequirementChip]


class JobResponse(BaseModel):
    id: str
    title: str
    description: str
    requirements: List[RequirementChip] = []
    candidates_count: int = 0
    created_at: str
    updated_at: str


class RequirementScore(BaseModel):
    requirement_id: str
    requirement_text: str
    category: str  # "must_have" | "nice_to_have"
    verdict: str  # "met" | "partial" | "missing"
    evidence_quote: Optional[str] = ""
    page_number: Optional[int] = 1
    confidence: str = "high"  # "high" | "medium" | "low"
    reasoning: Optional[str] = ""


class RiskFlag(BaseModel):
    type: str  # "employment_gap" | "low_evidence" | "tenure" | "missing_critical"
    description: str
    severity: str = "medium"  # "low" | "medium" | "high"


class CandidateListItem(BaseModel):
    id: str
    job_id: str
    filename: str
    name: str
    email: Optional[str] = ""
    skills: Optional[str] = ""
    education: Optional[str] = ""
    years_exp: float = 0.0
    status: str = "new"  # "new" | "shortlisted" | "maybe" | "rejected"
    notes: Optional[str] = ""
    fit_score: int = 0
    summary: Optional[str] = ""
    gaps: Optional[str] = ""
    must_haves_met: int = 0
    must_haves_total: int = 0
    nice_to_haves_met: int = 0
    nice_to_haves_total: int = 0
    score_breakdown: Optional[List[Dict[str, Any]]] = []
    risk_flags: Optional[List[RiskFlag]] = []
    created_at: str
    updated_at: str


class CandidateDetail(BaseModel):
    id: str
    job_id: str
    filename: str
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    skills: Optional[str] = ""
    education: Optional[str] = ""
    years_exp: float = 0.0
    status: str = "new"
    notes: Optional[str] = ""
    fit_score: int = 0
    summary: Optional[str] = ""
    gaps: Optional[str] = ""
    must_haves_met: int = 0
    must_haves_total: int = 0
    nice_to_haves_met: int = 0
    nice_to_haves_total: int = 0
    requirements: List[RequirementScore] = []
    interview_questions: List[str] = []
    risk_flags: List[RiskFlag] = []
    created_at: str
    updated_at: str


class CandidateStatusUpdate(BaseModel):
    status: Optional[str] = None  # "new" | "shortlisted" | "maybe" | "rejected"
    notes: Optional[str] = None


class CompareRequest(BaseModel):
    candidate_ids: List[str]
