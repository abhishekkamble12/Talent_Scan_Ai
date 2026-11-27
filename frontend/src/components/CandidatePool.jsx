import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Panel, PanelHeader, Badge, EmptyState } from "./ui";
import {
  Users,
  Search,
  FileCode,
  Sparkles,
  ArrowRight,
  UploadCloud,
  Trash2,
  GraduationCap,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { BACKEND_URL } from "../api/client";

const CandidatePool = ({
  resumes = [],
  hasJobDescription = false,
  onScreenCandidate,
  onNavigateToScreening,
  onLoadSample,
  loadingSample = false,
  onDataUpdated,
}) => {
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [deletingFile, setDeletingFile] = useState(null);
  const [error, setError] = useState("");

  const fetchCandidates = useCallback(async () => {
    if (resumes.length === 0) {
      setCandidates([]);
      return;
    }
    try {
      const res = await axios.get(`${BACKEND_URL}/api/candidates`);
      if (res.data?.candidates) {
        setCandidates(res.data.candidates);
      }
    } catch (err) {
      console.warn("Failed fetching candidates list:", err);
    }
  }, [resumes]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"? This will remove its vectors from ChromaDB.`)) {
      return;
    }
    setDeletingFile(filename);
    setError("");
    try {
      await axios.delete(`${BACKEND_URL}/api/candidates/${encodeURIComponent(filename)}`);
      setCandidates((prev) => prev.filter((c) => c.filename !== filename));
      onDataUpdated?.();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to delete ${filename}`);
    } finally {
      setDeletingFile(null);
    }
  };

  // Combine fetched structured profiles with any resumes in state
  const candidateMap = new Map(candidates.map((c) => [c.filename, c]));
  const combinedList = resumes.map((filename) => {
    return candidateMap.get(filename) || {
      filename,
      candidate_name: filename.replace(/[-_]resume.*$/i, "").replace(/[_-]/g, " "),
      top_skills: "",
      estimated_years_exp: 2,
      education: "PDF Document",
      summary: "",
    };
  });

  const query = search.trim().toLowerCase();
  const filtered = combinedList.filter((c) => {
    if (!query) return true;
    return (
      c.filename.toLowerCase().includes(query) ||
      (c.candidate_name && c.candidate_name.toLowerCase().includes(query)) ||
      (c.top_skills && c.top_skills.toLowerCase().includes(query)) ||
      (c.education && c.education.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-primary tracking-tight">Candidate Pool</h1>
            <Badge variant="accent" dot>
              {resumes.length} Ingested
            </Badge>
          </div>
          <p className="text-xs text-secondary mt-0.5">
            Browse structured candidate profiles, qualifications, and launch targeted AI evaluations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToScreening}
            className="px-3 py-1.5 rounded-md bg-elevated hover:bg-overlay text-primary border border-subtle text-xs font-medium transition interactive-button focus-ring"
          >
            Upload More PDFs
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-status-danger/10 border border-status-danger/30 rounded-md text-xs text-status-danger flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Directory Panel */}
      <Panel>
        <PanelHeader
          icon={Users}
          title="Candidate Profiles & Talent Roster"
          subtitle={
            hasJobDescription
              ? "Active job description loaded for role-fit matching"
              : "Tip: Add a job description in Candidate Screening for role-specific scoring"
          }
          action={
            resumes.length > 0 && (
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by name, skills, degree…"
                  aria-label="Filter candidate resumes"
                  className="w-full pl-8 pr-3 py-1.5 bg-root border border-subtle rounded-md text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
                />
              </div>
            )
          }
        />

        {resumes.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={UploadCloud}
              title="No candidate resumes in the pool"
              description="Upload PDF resumes in the Candidate Screening workspace or load our 6 sample software engineer resumes to get started."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={onLoadSample}
                    disabled={loadingSample}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent hover:bg-accent-hover text-root text-xs font-semibold transition interactive-button focus-ring"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{loadingSample ? "Loading Sample…" : "Load Sample Candidates"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateToScreening}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-elevated hover:bg-overlay text-primary border border-subtle text-xs font-medium transition interactive-button focus-ring"
                  >
                    <span>Go to Upload</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-secondary">
            No candidates match <span className="font-mono text-primary">&ldquo;{search}&rdquo;</span>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-secondary">
              <thead className="bg-elevated border-b border-subtle text-micro font-medium text-tertiary uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Candidate & Education</th>
                  <th className="px-5 py-3 hidden md:table-cell">Estimated Exp</th>
                  <th className="px-5 py-3">Key Skills</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {filtered.map((cand) => (
                  <tr key={cand.filename} className="hover:bg-elevated/50 transition-colors cv-deferred-row">
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-elevated border border-subtle flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                          <FileCode className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-primary font-semibold text-sm leading-tight truncate">
                            {cand.candidate_name || cand.filename}
                          </div>
                          <div className="text-micro font-mono text-tertiary truncate max-w-xs mt-0.5" title={cand.filename}>
                            {cand.filename}
                          </div>
                          {cand.education && (
                            <div className="inline-flex items-center gap-1 text-[11px] text-secondary mt-1">
                              <GraduationCap className="w-3 h-3 text-tertiary" />
                              <span className="truncate max-w-[240px]">{cand.education}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell align-top">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface border border-subtle text-xs font-medium text-primary">
                        <Briefcase className="w-3 h-3 text-tertiary" />
                        <span>~{cand.estimated_years_exp} yrs</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {cand.top_skills ? (
                          cand.top_skills.split(",").slice(0, 5).map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-1.5 py-0.5 rounded bg-elevated border border-subtle text-[11px] font-mono text-secondary"
                            >
                              {skill.trim()}
                            </span>
                          ))
                        ) : (
                          <span className="text-tertiary text-micro">General technical profile</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right align-top">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onScreenCandidate(cand.filename, cand.candidate_name)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent-tint hover:bg-accent-tint/80 text-accent border border-accent-border text-xs font-medium transition interactive-button focus-ring"
                          title={`Evaluate ${cand.candidate_name || cand.filename} with AI`}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span className="hidden sm:inline">Screen</span>
                        </button>
                        <button
                          type="button"
                          disabled={deletingFile === cand.filename}
                          onClick={() => handleDelete(cand.filename)}
                          className="p-1.5 rounded-md hover:bg-status-danger/10 text-tertiary hover:text-status-danger transition focus-ring"
                          title={`Delete ${cand.filename}`}
                          aria-label={`Delete ${cand.filename}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

export default CandidatePool;
