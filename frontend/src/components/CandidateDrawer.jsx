import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  Briefcase,
  GraduationCap,
  Sparkles,
  ExternalLink,
  Share2,
  BookOpen,
  Code2,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ScoreRing } from "./ScoreRing";
import { Badge } from "./ui";
import { BACKEND_URL } from "../api/client";

export const CandidateDrawer = ({
  candidateId,
  isOpen,
  onClose,
  onStatusUpdated,
}) => {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copiedQIdx, setCopiedQIdx] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [upskilling, setUpskilling] = useState(null);
  const [loadingUpskilling, setLoadingUpskilling] = useState(false);
  const [showUpskilling, setShowUpskilling] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!candidateId || !isOpen) {
      setCandidate(null);
      setUpskilling(null);
      setShowUpskilling(false);
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${BACKEND_URL}/api/candidates/${candidateId}`);
        setCandidate(res.data);
        setNotes(res.data.notes || "");
      } catch (err) {
        console.error("Failed fetching candidate detail:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [candidateId, isOpen]);

  // Lazy-load upskilling when expanded
  useEffect(() => {
    if (showUpskilling && !upskilling && candidateId) {
      const fetchUpskilling = async () => {
        setLoadingUpskilling(true);
        try {
          const res = await axios.get(`${BACKEND_URL}/api/candidates/${candidateId}/upskilling`);
          setUpskilling(res.data);
        } catch (err) {
          console.warn("Failed fetching upskilling roadmap:", err);
        } finally {
          setLoadingUpskilling(false);
        }
      };
      fetchUpskilling();
    }
  }, [showUpskilling, upskilling, candidateId]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleStatusChange = async (newStatus) => {
    if (!candidate) return;
    setUpdatingStatus(true);
    try {
      const res = await axios.patch(`${BACKEND_URL}/api/candidates/${candidate.id}`, {
        status: newStatus,
        notes: notes,
      });
      setCandidate(res.data);
      onStatusUpdated?.(res.data);
    } catch (err) {
      console.error("Failed updating candidate status:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleNotesBlur = async () => {
    if (!candidate || notes === (candidate.notes || "")) return;
    setSavingNotes(true);
    try {
      const res = await axios.patch(`${BACKEND_URL}/api/candidates/${candidate.id}`, {
        notes: notes,
      });
      setCandidate(res.data);
      onStatusUpdated?.(res.data);
    } catch (err) {
      console.error("Failed saving notes:", err);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleShareLink = async () => {
    if (!candidate) return;
    setSharing(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/candidates/${candidate.id}/share`);
      const fullUrl = `${window.location.origin}${res.data.share_url}`;
      await navigator.clipboard.writeText(fullUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2600);
    } catch (err) {
      console.error("Failed creating share link:", err);
    } finally {
      setSharing(false);
    }
  };

  const handleCopyFeedback = () => {
    if (!upskilling) return;
    const items = upskilling.roadmap_items || [];
    let text = `Hi ${candidate.name || "there"},\n\nThank you for speaking with us. Here is personalized feedback and recommended learning tracks based on our technical requirements:\n\n`;
    text += `${upskilling.coaching_summary}\n\nKey areas to build:\n`;
    items.forEach((item, i) => {
      text += `\n${i + 1}. ${item.skill} (${item.priority})\n`;
      text += `   - Project idea: ${item.practice_project}\n`;
      if (item.courses?.[0]) text += `   - Recommended course: ${item.courses[0]}\n`;
    });
    text += `\nBest regards,\nTalent Acquisition Team`;

    navigator.clipboard.writeText(text);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2400);
  };

  const handleCopyQuestion = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedQIdx(idx);
    setTimeout(() => setCopiedQIdx(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-candidate-title"
          className="w-screen max-w-lg bg-surface border-l border-subtle shadow-2xl flex flex-col h-full transform transition-transform ease-out duration-200"
        >
          {loading || !candidate ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-secondary">Loading candidate profile &amp; auditable evidence…</p>
            </div>
          ) : (
            <>
              {/* Drawer Header */}
              <div className="p-5 border-b border-subtle bg-elevated/40 flex items-start justify-between gap-4 flex-shrink-0">
                <div className="flex items-start gap-3 min-w-0">
                  <ScoreRing score={candidate.fit_score} size="md" />
                  <div className="min-w-0">
                    <h2 id="drawer-candidate-title" className="text-base font-semibold text-primary truncate">
                      {candidate.name || candidate.filename}
                    </h2>
                    <div className="flex items-center gap-2 text-micro text-tertiary mt-0.5 truncate">
                      <span className="font-mono">{candidate.filename}</span>
                      {candidate.years_exp > 0 && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-secondary">
                            <Briefcase className="w-3 h-3" />
                            ~{candidate.years_exp} yrs
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleShareLink}
                    disabled={sharing}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition ${
                      shareCopied
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold"
                        : "bg-elevated text-secondary hover:text-primary hover:border-accent border-subtle"
                    }`}
                    title="Generate public shareable link for hiring manager"
                  >
                    {shareCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-accent" />
                        <span>Share</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-md text-tertiary hover:text-primary hover:bg-elevated transition focus-ring"
                    aria-label="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status & Decision Action Bar */}
              <div className="px-5 py-3 border-b border-subtle bg-root/40 flex items-center justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-micro font-mono uppercase tracking-wider text-tertiary mr-1">Status:</span>
                  <button
                    type="button"
                    onClick={() => handleStatusChange("shortlisted")}
                    disabled={updatingStatus}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition interactive-button focus-ring ${
                      candidate.status === "shortlisted"
                        ? "bg-emerald-500 text-root font-bold shadow-xs"
                        : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                    }`}
                  >
                    Shortlist
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange("maybe")}
                    disabled={updatingStatus}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition interactive-button focus-ring ${
                      candidate.status === "maybe"
                        ? "bg-amber-500 text-root font-bold shadow-xs"
                        : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30"
                    }`}
                  >
                    Maybe
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange("rejected")}
                    disabled={updatingStatus}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition interactive-button focus-ring ${
                      candidate.status === "rejected"
                        ? "bg-rose-500 text-root font-bold shadow-xs"
                        : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30"
                    }`}
                  >
                    Reject
                  </button>
                </div>

                <Badge
                  variant={
                    candidate.status === "shortlisted"
                      ? "success"
                      : candidate.status === "rejected"
                      ? "error"
                      : candidate.status === "maybe"
                      ? "warning"
                      : "neutral"
                  }
                  dot
                >
                  {candidate.status.toUpperCase()}
                </Badge>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* AI Executive Summary */}
                {candidate.summary && (
                  <div className="p-3.5 rounded-lg bg-accent-tint/40 border border-accent-border/50 text-xs leading-relaxed text-primary space-y-1">
                    <div className="flex items-center gap-1.5 text-accent font-semibold text-micro uppercase tracking-wider font-mono">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Executive Assessment</span>
                    </div>
                    <p>{candidate.summary}</p>
                  </div>
                )}

                {/* Risk Flags */}
                {candidate.risk_flags && candidate.risk_flags.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-micro font-mono uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Identified Risk Flags</span>
                    </h3>
                    <div className="space-y-1.5">
                      {candidate.risk_flags.map((flag, fIdx) => (
                        <div
                          key={fIdx}
                          className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 leading-normal flex items-start gap-2"
                        >
                          <span className="font-bold text-rose-400 mt-0.5">•</span>
                          <span>{flag.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-Requirement Evidence Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wider font-mono">
                      Requirement Evidence ({candidate.must_haves_met}/{candidate.must_haves_total} Must-Haves)
                    </h3>
                    <span className="text-micro text-tertiary">Verified in PDF</span>
                  </div>

                  <div className="space-y-2.5">
                    {candidate.requirements && candidate.requirements.map((req, rIdx) => {
                      const isMet = req.verdict === "met";
                      const isPartial = req.verdict === "partial";
                      return (
                        <div
                          key={rIdx}
                          className={`p-3 rounded-lg border text-xs space-y-2 transition ${
                            isMet
                              ? "bg-elevated/40 border-emerald-500/30"
                              : isPartial
                              ? "bg-elevated/40 border-amber-500/30"
                              : "bg-root/60 border-subtle/80 opacity-80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <span
                                className={`font-bold text-sm leading-none mt-0.5 ${
                                  isMet
                                    ? "text-emerald-400"
                                    : isPartial
                                    ? "text-amber-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {isMet ? "✓" : isPartial ? "◐" : "✗"}
                              </span>
                              <div>
                                <span className="font-medium text-primary leading-tight">
                                  {req.requirement_text}
                                </span>
                                {req.category === "must_have" && (
                                  <span className="ml-1.5 text-[10px] font-mono text-tertiary uppercase">
                                    [Must-Have]
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge
                              variant={isMet ? "success" : isPartial ? "warning" : "error"}
                              className="text-[10px]"
                            >
                              {req.verdict.toUpperCase()}
                            </Badge>
                          </div>

                          {/* Evidence Quote Citation */}
                          {req.evidence_quote ? (
                            <blockquote className="pl-2.5 border-l-2 border-accent text-secondary text-micro italic bg-root/40 py-1 pr-2 rounded-r">
                              &ldquo;{req.evidence_quote.replace(/^"|"$/g, "")}&rdquo;
                              {req.page_number && (
                                <span className="ml-2 font-mono not-italic text-accent underline cursor-pointer" title="Jump to page in PDF">
                                  p. {req.page_number}
                                </span>
                              )}
                            </blockquote>
                          ) : (
                            <p className="text-micro text-tertiary italic pl-5">
                              No matching evidence located in resume pages.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Suggested Interview Questions */}
                {candidate.interview_questions && candidate.interview_questions.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wider font-mono">
                      Suggested Interview Questions
                    </h3>
                    <div className="space-y-2">
                      {candidate.interview_questions.map((q, qIdx) => (
                        <div
                          key={qIdx}
                          className="group p-3 rounded-lg bg-elevated/60 border border-subtle text-xs text-secondary hover:text-primary space-y-1.5 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-accent font-semibold text-micro">Q{qIdx + 1}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyQuestion(q, qIdx)}
                              className="p-1 rounded text-tertiary hover:text-primary transition focus-ring"
                              title="Copy question"
                            >
                              {copiedQIdx === qIdx ? (
                                <Check className="w-3.5 h-3.5 text-accent" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <p className="leading-relaxed">{q}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upskilling Roadmap & Candidate Coaching */}
                <div className="space-y-2.5 pt-2 border-t border-subtle">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowUpskilling(!showUpskilling)}
                      className="text-xs font-semibold text-primary uppercase tracking-wider font-mono flex items-center gap-2 hover:text-accent transition cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-accent" />
                      <span>Skill Gaps & Upskilling Plan</span>
                      {showUpskilling ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showUpskilling && upskilling && (
                      <button
                        type="button"
                        onClick={handleCopyFeedback}
                        className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline font-medium cursor-pointer"
                      >
                        {copiedFeedback ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedFeedback ? "Copied Feedback!" : "Copy Coaching Message"}
                      </button>
                    )}
                  </div>

                  {showUpskilling && (
                    <div className="p-3.5 rounded-lg bg-root/70 border border-subtle space-y-3">
                      {loadingUpskilling ? (
                        <div className="text-xs text-secondary flex items-center gap-2 py-2">
                          <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                          Generating tailored upskilling recommendations…
                        </div>
                      ) : upskilling ? (
                        <>
                          <p className="text-xs text-secondary leading-relaxed">
                            {upskilling.coaching_summary}
                          </p>
                          {upskilling.roadmap_items?.length > 0 && (
                            <div className="space-y-2 pt-1">
                              {upskilling.roadmap_items.map((item, i) => (
                                <div key={i} className="p-2.5 rounded bg-surface border border-subtle space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-primary">{item.skill}</span>
                                    <span className="text-micro font-mono text-tertiary flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {item.time_to_close}
                                    </span>
                                  </div>
                                  {item.courses?.[0] && (
                                    <div className="text-secondary text-[11px] flex items-center gap-1.5">
                                      <span className="text-accent">•</span> Course: {item.courses[0]}
                                    </div>
                                  )}
                                  <div className="text-secondary text-[11px] flex items-start gap-1.5">
                                    <span className="text-accent mt-0.5">•</span> Project: {item.practice_project}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-tertiary">No specific skill gaps recorded for this candidate.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Recruiter Notes */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="candidate-recruiter-notes" className="text-xs font-semibold text-primary uppercase tracking-wider font-mono">
                      Recruiter Notes
                    </label>
                    {savingNotes && (
                      <span className="text-micro font-mono text-accent animate-pulse">Auto-saving…</span>
                    )}
                  </div>
                  <textarea
                    id="candidate-recruiter-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                    placeholder="Add interview feedback, salary expectation notes, or next steps (auto-saves on blur)…"
                    rows={3}
                    className="w-full p-2.5 bg-root border border-subtle rounded-md text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent"
                  />
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-subtle bg-elevated/40 flex items-center justify-between gap-2 flex-shrink-0 text-xs">
                <span className="text-tertiary font-mono text-micro">Candidate ID: {candidate.id.slice(0, 8)}</span>
                <a
                  href={`${BACKEND_URL}/uploads/pdfs/${encodeURIComponent(candidate.filename)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-accent hover:underline focus-ring rounded"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Original PDF</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default CandidateDrawer;
