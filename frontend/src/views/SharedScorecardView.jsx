import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  AlertTriangle,
  Briefcase,
  GraduationCap,
  Sparkles,
  Printer,
  ArrowLeft,
  ShieldCheck,
  FileText,
  Clock,
  Layers,
} from "lucide-react";
import { ScoreRing } from "../components/ScoreRing";
import { Badge } from "../components/ui";
import { BACKEND_URL } from "../api/client";

export const SharedScorecardView = ({ token, onBackToApp }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No share token provided.");
      setLoading(false);
      return;
    }

    const fetchScorecard = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get(`${BACKEND_URL}/api/public/share/${token}`);
        setData(res.data);
      } catch (err) {
        setError(
          err.response?.data?.error ||
            "Unable to load scorecard. The link may have expired or been revoked."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchScorecard();
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-root text-primary flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm text-secondary">Loading verified match scorecard…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-root text-primary flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-subtle rounded-xl p-6 text-center space-y-4 shadow-lg">
          <div className="w-12 h-12 rounded-full bg-danger-tint border border-danger-border text-danger mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-primary">Scorecard Unavailable</h2>
          <p className="text-xs text-secondary leading-relaxed">{error}</p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-hover border border-subtle text-xs text-primary font-medium hover:border-accent transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to TalentScan
            </button>
          )}
        </div>
      </div>
    );
  }

  const {
    name,
    filename,
    job_title,
    fit_score,
    summary,
    gaps,
    status,
    skills,
    years_exp,
    education,
    requirements = [],
    interview_questions = [],
    risk_flags = [],
  } = data;

  const mustHaves = requirements.filter((r) => (r.requirement_category || r.category) === "must_have");
  const niceToHaves = requirements.filter((r) => (r.requirement_category || r.category) === "nice_to_have");

  return (
    <div className="min-h-screen bg-root text-primary p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-4xl space-y-6">
        {/* Top Public Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm shadow-sm">
              TS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-primary tracking-tight">TalentScan AI</h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success-tint border border-success-border px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Audited Scorecard
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                Evaluation for: <span className="text-primary font-medium">{job_title}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-subtle text-xs text-primary font-medium hover:border-accent hover:bg-surface-hover transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover border border-subtle text-xs text-secondary hover:text-primary transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Workspace
              </button>
            )}
          </div>
        </header>

        {/* Candidate Overview Card */}
        <div className="bg-surface border border-subtle rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-primary tracking-tight">{name}</h2>
                <Badge
                  tone={
                    status === "shortlisted"
                      ? "success"
                      : status === "rejected"
                      ? "danger"
                      : "neutral"
                  }
                >
                  {status ? status.toUpperCase() : "SCREENED"}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-secondary pt-1">
                {years_exp > 0 && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-tertiary" /> {years_exp} yrs experience
                  </span>
                )}
                {education && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-tertiary" /> {education}
                  </span>
                )}
                {filename && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-tertiary" /> {filename}
                  </span>
                )}
              </div>

              {summary && (
                <p className="text-xs text-primary bg-root/70 border border-subtle rounded-lg p-3 mt-3 leading-relaxed">
                  <span className="text-accent font-semibold mr-1">Executive Summary:</span>
                  {summary}
                </p>
              )}
            </div>

            {/* Score Ring */}
            <div className="flex flex-col items-center justify-center min-w-[120px] bg-root border border-subtle rounded-xl p-4">
              <ScoreRing score={fit_score} size={68} strokeWidth={6} />
              <span className="text-[11px] font-medium text-secondary mt-1">Role Match Fit</span>
            </div>
          </div>
        </div>

        {/* Requirements Breakdown (Evidence Citations) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" /> Auditable Requirement Verification
            </h3>
            <span className="text-micro text-tertiary">Every score is backed by resume citation</span>
          </div>

          {/* Must Haves */}
          {mustHaves.length > 0 && (
            <div className="bg-surface border border-subtle rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider text-tertiary">
                Must-Have Requirements ({mustHaves.filter((m) => m.verdict === "met").length}/{mustHaves.length} Met)
              </h4>
              <div className="space-y-2.5">
                {mustHaves.map((req, idx) => (
                  <RequirementEvidenceRow key={idx} req={req} />
                ))}
              </div>
            </div>
          )}

          {/* Nice to Haves */}
          {niceToHaves.length > 0 && (
            <div className="bg-surface border border-subtle rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider text-tertiary">
                Nice-to-Have Requirements ({niceToHaves.filter((m) => m.verdict === "met").length}/{niceToHaves.length} Met)
              </h4>
              <div className="space-y-2.5">
                {niceToHaves.map((req, idx) => (
                  <RequirementEvidenceRow key={idx} req={req} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Risk Flags & Identified Gaps */}
        {(risk_flags?.length > 0 || gaps) && (
          <div className="bg-surface border border-subtle rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-warning uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Detected Gaps & Flags
            </h3>
            {gaps && (
              <p className="text-xs text-secondary leading-relaxed bg-warning-tint/20 border border-warning-border/40 p-3 rounded-lg">
                <span className="font-semibold text-warning mr-1">Missing Competencies:</span> {gaps}
              </p>
            )}
            {risk_flags?.map((flag, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-secondary bg-root p-2.5 rounded-lg border border-subtle">
                <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                <span>{typeof flag === "string" ? flag : flag.description || flag.type}</span>
              </div>
            ))}
          </div>
        )}

        {/* Suggested Interview Questions */}
        {interview_questions?.length > 0 && (
          <div className="bg-surface border border-subtle rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Recommended Technical Interview Questions
            </h3>
            <div className="space-y-2">
              {interview_questions.map((q, idx) => (
                <div key={idx} className="text-xs text-primary bg-root p-3 rounded-lg border border-subtle leading-relaxed">
                  <span className="font-semibold text-accent mr-1.5">Q{idx + 1}:</span>
                  {q}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Public Footer */}
        <footer className="pt-6 pb-12 text-center text-micro text-tertiary border-t border-subtle">
          TalentScan AI • Objective, Auditable Candidate Intelligence • Verified via Structured Citations
        </footer>
      </div>
    </div>
  );
};

const RequirementEvidenceRow = ({ req }) => {
  const verdict = req.verdict || "missing";
  const reqText = req.requirement_text || req.text || "";
  const quote = req.evidence_quote || "";
  const page = req.page_number;

  return (
    <div className="p-3 rounded-lg bg-root border border-subtle space-y-1.5 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-medium text-primary">
          {verdict === "met" && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
          {verdict === "partial" && <AlertCircle className="w-4 h-4 text-warning shrink-0" />}
          {verdict === "missing" && <HelpCircle className="w-4 h-4 text-danger shrink-0" />}
          <span>{reqText}</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-micro font-medium uppercase shrink-0 ${
            verdict === "met"
              ? "bg-success-tint text-success border border-success-border"
              : verdict === "partial"
              ? "bg-warning-tint text-warning border border-warning-border"
              : "bg-danger-tint text-danger border border-danger-border"
          }`}
        >
          {verdict}
        </span>
      </div>

      {quote ? (
        <div className="text-secondary pl-6 text-[11px] leading-relaxed italic">
          "{quote}"
          {page && (
            <span className="ml-1.5 text-tertiary not-italic font-mono text-micro">
              (Page {page})
            </span>
          )}
        </div>
      ) : (
        <div className="text-tertiary pl-6 text-micro">No direct evidence found in resume.</div>
      )}
    </div>
  );
};
