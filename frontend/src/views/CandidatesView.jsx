import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Users,
  Sparkles,
  Upload,
  Layers,
  List,
  LayoutGrid,
  FileText,
  Sliders,
  AlertCircle,
  RefreshCw,
  Plus,
  CheckCircle2,
  Check,
} from "lucide-react";
import { FilterBar } from "../components/FilterBar";
import { RankedTable } from "../components/RankedTable";
import { PipelineBoard } from "../components/PipelineBoard";
import { CandidateDrawer } from "../components/CandidateDrawer";
import { RequirementChips } from "../components/RequirementChips";
import { CompareMatrix } from "../components/CompareMatrix";
import { BulkUploadModal } from "../components/BulkUploadModal";
import { AskAIView } from "./AskAIView";
import { JobAnalyticsView } from "./JobAnalyticsView";
import { EmptyState, Badge } from "../components/ui";
import { BACKEND_URL } from "../api/client";

export const CandidatesView = ({
  job,
  onJobUpdated,
  onOpenCreateJob,
  onTriggerDemoSeed,
}) => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("candidates"); // "candidates" | "requirements" | "compare" | "ask" | "analytics"
  const [viewMode, setViewMode] = useState("table"); // "table" | "pipeline"
  const [blindMode, setBlindMode] = useState(false);
  const [sortMode, setSortMode] = useState("fit_score"); // "fit_score" | "smart_rerank"
  const [modelTrained, setModelTrained] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);

  // Selections & Modals
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [isScreening, setIsScreening] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }, []);

  const fetchCandidates = useCallback(async () => {
    if (!job?.id) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${BACKEND_URL}/api/jobs/${job.id}/candidates?sort=${sortMode}`);
      setCandidates(res.data.candidates || []);
      setModelTrained(Boolean(res.data.model_trained));
      setFeedbackSignal(res.data.feedback_signal || "");
    } catch (err) {
      setError(err.response?.data?.error || "Failed fetching candidates.");
    } finally {
      setLoading(false);
    }
  }, [job?.id, sortMode]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Handle re-screen all
  const handleTriggerRescreen = async () => {
    if (!job?.id) return;
    setIsScreening(true);
    try {
      const sseRes = await fetch(`${BACKEND_URL}/api/jobs/${job.id}/screen`, {
        method: "POST",
      });
      if (sseRes.body) {
        const reader = sseRes.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
      await fetchCandidates();
    } catch (err) {
      console.error("Rescreen error:", err);
    } finally {
      setIsScreening(false);
    }
  };

  const handleOpenDrawer = (candidateId) => {
    setSelectedCandidateId(candidateId);
    setDrawerOpen(true);
  };

  const handleToggleSelect = (candidateId) => {
    setSelectedIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id) => id !== candidateId) : [...prev, candidateId]
    );
  };

  const handleStatusChangeFromBoard = async (candidateId, newStatus) => {
    try {
      await axios.patch(`${BACKEND_URL}/api/candidates/${candidateId}`, { status: newStatus });
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, status: newStatus } : c))
      );
      showToast(`Candidate marked as ${newStatus.toUpperCase()}`);
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const handleExportCsv = () => {
    if (!job?.id) return;
    window.open(`${BACKEND_URL}/api/jobs/${job.id}/export`, "_blank");
    showToast("Downloading CSV report…");
  };

  // Filter candidates locally for responsive filtering
  const query = search.trim().toLowerCase();
  const filteredCandidates = candidates.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (minScore > 0 && (c.fit_score || 0) < minScore) return false;
    if (!query) return true;
    const blob = `${c.name} ${c.skills} ${c.education} ${c.gaps} ${c.filename}`.toLowerCase();
    return blob.includes(query);
  });

  // Keyboard shortcuts: J/K to navigate candidates, S to shortlist, R to reject
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (activeSubTab !== "candidates" || filteredCandidates.length === 0) return;

      const key = e.key.toLowerCase();
      if (key === "j" || key === "k") {
        e.preventDefault();
        const idx = filteredCandidates.findIndex((c) => c.id === selectedCandidateId);
        const nextIdx =
          key === "j"
            ? idx < filteredCandidates.length - 1 ? idx + 1 : 0
            : idx > 0 ? idx - 1 : filteredCandidates.length - 1;
        setSelectedCandidateId(filteredCandidates[nextIdx].id);
        setDrawerOpen(true);
      } else if (drawerOpen && selectedCandidateId && (key === "s" || key === "r")) {
        e.preventDefault();
        const newStatus = key === "s" ? "shortlisted" : "rejected";
        handleStatusChangeFromBoard(selectedCandidateId, newStatus);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSubTab, filteredCandidates, selectedCandidateId, drawerOpen]);

  if (!job) {
    return (
      <EmptyState
        icon={FileText}
        title="No Job Workspace Selected"
        description="Select a job from the top bar switcher or create a new job from a Job Description."
        action={
          <button
            type="button"
            onClick={onOpenCreateJob}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-root font-semibold text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Job</span>
          </button>
        }
      />
    );
  }

  const hasReqs = (job.requirements?.length || 0) > 0;
  const hasCands = candidates.length > 0;
  const hasDecisions = candidates.some((c) => c.status && c.status !== "new");

  const workflowSteps = [
    { id: "req", label: "1. Job Criteria", done: hasReqs, action: () => setActiveSubTab("requirements") },
    { id: "upload", label: "2. Upload Resumes", done: hasCands, action: () => setUploadModalOpen(true) },
    { id: "review", label: "3. Ranked Review", done: hasCands, action: () => setActiveSubTab("candidates") },
    { id: "decide", label: "4. Compare & Decide", done: hasDecisions, action: () => setActiveSubTab("compare") },
  ];

  return (
    <div className="space-y-5 relative">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-elevated border border-accent text-primary text-xs font-medium shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
        >
          <Check className="w-3.5 h-3.5 text-accent" />
          <span>{toast}</span>
        </div>
      )}

      {/* Guided 4-Step Hiring Workflow Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {workflowSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={step.action}
            className={`px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-2 transition focus-ring ${
              step.done
                ? "bg-surface border-subtle hover:border-accent/50 text-primary"
                : "bg-root/40 border-dashed border-subtle hover:border-tertiary text-secondary"
            }`}
          >
            <span className="text-xs font-medium truncate">{step.label}</span>
            {step.done ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-tertiary/40 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Workspace Header & Sub-Tabs */}
      <div className="border-b border-subtle pb-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-primary tracking-tight">{job.title}</h1>
              <Badge variant="accent" dot>
                {candidates.length} Candidates
              </Badge>
            </div>
            <p className="text-xs text-secondary mt-0.5 line-clamp-1 max-w-2xl">
              {job.description?.slice(0, 180)}…
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-root font-semibold text-xs transition interactive-button focus-ring"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>+ Upload Resumes</span>
            </button>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-subtle -mb-4 pt-1">
          <button
            type="button"
            onClick={() => setActiveSubTab("candidates")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition -mb-[2px] ${
              activeSubTab === "candidates"
                ? "border-accent text-accent"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            Candidates ({candidates.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("requirements")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition -mb-[2px] ${
              activeSubTab === "requirements"
                ? "border-accent text-accent"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            Requirements ({job.requirements?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("compare")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition -mb-[2px] ${
              activeSubTab === "compare"
                ? "border-accent text-accent"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            Compare Matrix {selectedIds.length > 0 && `(${selectedIds.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("ask")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition -mb-[2px] ${
              activeSubTab === "ask"
                ? "border-accent text-accent"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            Ask AI Copilot
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("analytics")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition -mb-[2px] ${
              activeSubTab === "analytics"
                ? "border-accent text-accent"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            Hiring Analytics
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sub-Tab 1: Candidates View (Table | Pipeline) */}
      {activeSubTab === "candidates" && (
        <div className="space-y-4">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            minScore={minScore}
            onMinScoreChange={setMinScore}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            modelTrained={modelTrained}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            blindMode={blindMode}
            onToggleBlindMode={() => setBlindMode((p) => !p)}
            onExportCsv={candidates.length > 0 ? handleExportCsv : null}
            totalCount={candidates.length}
            filteredCount={filteredCandidates.length}
          />

          {/* Feedback-Weighted Smart Reranker Status Banner */}
          {sortMode === "smart_rerank" && (
            <div className="px-3.5 py-2 rounded-lg bg-accent-tint/30 border border-accent-border/50 text-xs text-primary flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-secondary">{feedbackSignal || "Smart Reranker active based on recruiter shortlist/reject feedback."}</span>
              </div>
              <span className="text-micro font-mono text-accent uppercase font-semibold">
                {modelTrained ? "Adaptive Model Active" : "Baseline Blend"}
              </span>
            </div>
          )}

          {candidates.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Candidates in this Job Workspace"
              description="Upload PDF resumes to auto-screen them against this job's criteria, or seed the workspace with pre-screened candidates."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-root font-semibold text-xs"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Resumes</span>
                  </button>
                  {onTriggerDemoSeed && (
                    <button
                      type="button"
                      onClick={onTriggerDemoSeed}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-elevated hover:bg-overlay border border-subtle text-primary text-xs font-medium"
                    >
                      <Sparkles className="w-4 h-4 text-accent" />
                      <span>Load 1-Click Demo</span>
                    </button>
                  )}
                </div>
              }
            />
          ) : viewMode === "table" ? (
            <RankedTable
              candidates={filteredCandidates}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectCandidate={handleOpenDrawer}
              onCompareSelected={() => setActiveSubTab("compare")}
              blindMode={blindMode}
              sortMode={sortMode}
            />
          ) : (
            <PipelineBoard
              candidates={filteredCandidates}
              onSelectCandidate={handleOpenDrawer}
              onStatusChange={handleStatusChangeFromBoard}
              blindMode={blindMode}
            />
          )}
        </div>
      )}

      {/* Sub-Tab 2: Requirements View */}
      {activeSubTab === "requirements" && (
        <RequirementChips
          jobId={job.id}
          requirements={job.requirements || []}
          onRequirementsUpdated={(updated) => onJobUpdated?.({ ...job, requirements: updated })}
          onTriggerRescreen={handleTriggerRescreen}
          isScreening={isScreening}
        />
      )}

      {/* Sub-Tab 3: Compare Matrix */}
      {activeSubTab === "compare" && (
        <CompareMatrix
          jobId={job.id}
          candidateIds={selectedIds.length >= 2 ? selectedIds : candidates.slice(0, 4).map((c) => c.id)}
          onBack={() => setActiveSubTab("candidates")}
          onSelectCandidate={handleOpenDrawer}
          blindMode={blindMode}
        />
      )}

      {/* Sub-Tab 4: Scoped Ask AI */}
      {activeSubTab === "ask" && (
        <AskAIView
          job={job}
          candidates={candidates}
          onOpenCandidateDrawer={handleOpenDrawer}
        />
      )}

      {/* Sub-Tab 5: Hiring Funnel & Job Analytics */}
      {activeSubTab === "analytics" && (
        <JobAnalyticsView job={job} />
      )}

      {/* Candidate Detail Drawer */}
      <CandidateDrawer
        candidateId={selectedCandidateId}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onStatusUpdated={(updated) => {
          setCandidates((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
          );
        }}
      />

      {/* Bulk Upload & Auto-Screen Modal */}
      <BulkUploadModal
        jobId={job.id}
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadAndScreenComplete={fetchCandidates}
      />
    </div>
  );
};

export default CandidatesView;
