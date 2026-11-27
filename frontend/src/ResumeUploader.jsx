import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Panel, PanelHeader, Badge } from "./components/ui";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  Database,
  X,
  FilePlus2,
  FileCode,
  FolderCheck,
} from "lucide-react";

import { BACKEND_URL } from "./api/client";

const SAMPLE_JOB_DESCRIPTION = `Full Stack Software Engineer (React & Python)

About the Role:
We need a Full Stack Engineer to build and maintain user-facing web applications. You will work across the React client and Python backend, shipping production features alongside our product and data teams.

Key Responsibilities:
- Build accessible, high-performance web interfaces with React, TypeScript, and TailwindCSS.
- Build and maintain REST APIs with Python (FastAPI, Flask, or Django).
- Manage relational and vector databases (PostgreSQL, ChromaDB).
- Integrate LLM workflows, Retrieval-Augmented Generation (RAG) pipelines, and document search.
- Write unit and integration tests for critical user flows and API endpoints.

Qualifications:
- 2+ years of full-stack software development experience.
- Hands-on experience with JavaScript/TypeScript, React, and semantic HTML/CSS.
- Experience building APIs and database schemas in Python.
- Practical experience with Git, Docker, and CI/CD pipelines (AWS or GCP).
- Experience working with external APIs and asynchronous tasks.`;

const ResumeUploader = ({ onDataUpdated, currentStatus }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [jobDescription, setJobDescription] = useState("");
  const [hasHydratedJD, setHasHydratedJD] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [alert, setAlert] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const fileInputRef = useRef(null);

  // Hydrate saved job description from backend status on initial load
  useEffect(() => {
    if (!hasHydratedJD && currentStatus?.job_description_full && !jobDescription) {
      setJobDescription(currentStatus.job_description_full);
      setHasHydratedJD(true);
    }
  }, [currentStatus?.job_description_full, hasHydratedJD, jobDescription]);

  /* ── File helpers ── */
  const addPdfs = (files) => {
    const pdfs = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length < files.length) {
      setAlert({ type: "error", message: "Non-PDF files were skipped. Only PDF resumes are supported." });
    } else {
      setAlert(null);
    }
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...pdfs.filter((f) => !existing.has(f.name + f.size))];
    });
  };

  const handleFileChange = (e) => {
    addPdfs(e.target.files || []);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addPdfs(e.dataTransfer.files);
  };

  const removeFile = (idx) => setSelectedFiles((p) => p.filter((_, i) => i !== idx));

  /* ── Actions ── */
  const handleFillSampleJD = () => {
    setJobDescription(SAMPLE_JOB_DESCRIPTION);
    setAlert({ type: "success", message: "Sample engineering job description inserted." });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim()) {
      setAlert({ type: "error", message: "Please provide a job description before indexing." });
      return;
    }
    if (!selectedFiles.length && indexedResumes.length === 0) {
      setAlert({ type: "error", message: "Please select at least one PDF resume to upload." });
      return;
    }
    setLoading(true);
    setLoadingMessage(
      selectedFiles.length > 0
        ? "Extracting resume text & indexing embeddings…"
        : "Updating job description…"
    );
    setAlert(null);
    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append("resumes", f));
    formData.append("job_description", jobDescription);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAlert({
        type: "success",
        message:
          res.data.message ||
          (selectedFiles.length > 0
            ? `Indexed ${selectedFiles.length} candidate resumes.`
            : "Job description updated."),
      });
      setSelectedFiles([]);
      onDataUpdated?.();
    } catch (err) {
      setAlert({
        type: "error",
        message: err.response?.data?.error || "Upload failed. Please verify the backend service is running.",
      });
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleLoadSampleDemo = async () => {
    setLoading(true);
    setLoadingMessage("Loading sample candidate profiles & job description…");
    setAlert(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/load-sample`);
      setAlert({
        type: "success",
        message: res.data.message || "Sample candidates and job description are ready.",
      });
      if (res.data.job_description) {
        setJobDescription(res.data.job_description);
        setHasHydratedJD(true);
      }
      onDataUpdated?.();
    } catch (err) {
      setAlert({
        type: "error",
        message: err.response?.data?.error || "Failed to load sample candidates.",
      });
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleReset = async () => {
    setConfirmingReset(false);
    setLoading(true);
    setLoadingMessage("Clearing candidate pool & vector index…");
    setAlert(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/reset`);
      setAlert({
        type: "success",
        message: res.data.message || "Candidate pool and vector index cleared.",
      });
      setSelectedFiles([]);
      setJobDescription("");
      setHasHydratedJD(false);
      onDataUpdated?.();
    } catch {
      setAlert({ type: "error", message: "Unable to reset the candidate pool." });
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const indexedResumes = currentStatus?.resumes || [];

  return (
    <Panel className="flex flex-col relative">
      {/* ── Directional Progress Sweep ── */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-elevated overflow-hidden z-20">
          <div className="h-full bg-accent animate-sweep w-1/2" />
        </div>
      )}

      <PanelHeader
        icon={FileText}
        title="Role & Candidate Pool"
        subtitle="Configure job requirements and index candidate PDFs"
        action={
          <button
            type="button"
            onClick={handleLoadSampleDemo}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-accent bg-accent-tint hover:bg-accent-tint/80 border border-accent-border rounded-sm transition interactive-button focus-ring"
            title="Load 6 pre-bundled sample resumes and a Software Engineer JD"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample</span>
          </button>
        }
      />

      <div className="p-5 space-y-5 flex-1">
        {/* ── Feedback Notification ── */}
        <div aria-live="polite" aria-atomic="true">
          {alert && (
            <div
              role="status"
              className={`flex items-start gap-2.5 p-3 rounded-md text-xs border ${
                alert.type === "success"
                  ? "bg-status-success-bg text-status-success border-status-success-border"
                  : "bg-status-error-bg text-status-error border-status-error-border"
              }`}
            >
              {alert.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-accent" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-status-error" />
              )}
              <span className="flex-1 leading-relaxed">{alert.message}</span>
              <button
                type="button"
                onClick={() => setAlert(null)}
                className="text-tertiary hover:text-primary transition p-0.5 focus-ring"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Active Indexed Resumes Summary ── */}
        {indexedResumes.length > 0 && (
          <div className="rounded-md border border-subtle bg-root/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <FolderCheck className="w-3.5 h-3.5 text-accent" />
                <span>Active Candidate Pool</span>
              </div>
              <Badge variant="accent">{indexedResumes.length} indexed</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-0.5">
              {indexedResumes.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-elevated border border-subtle text-[11px] font-mono text-secondary"
                  title={name}
                >
                  <FileCode className="w-3 h-3 text-tertiary" />
                  <span className="truncate max-w-[140px]">{name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Job Description Input ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="job-description-input"
                className="text-xs font-medium text-secondary flex items-center gap-1.5"
              >
                <span>Job Description</span>
              </label>
              <button
                type="button"
                onClick={handleFillSampleJD}
                className="text-xs text-accent hover:underline focus-ring rounded-sm"
              >
                Use sample template
              </button>
            </div>
            <textarea
              id="job-description-input"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description, key responsibilities, and required qualifications…"
              rows={5}
              disabled={loading}
              className="w-full p-3 bg-root border border-subtle rounded-md text-primary placeholder:text-tertiary text-xs font-sans focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent transition resize-y leading-relaxed textarea-auto-grow"
            />
          </div>

          {/* ── Accessible Drop Zone ── */}
          <div>
            <span className="text-xs font-medium text-secondary mb-1.5 block">
              Add Candidate Resumes (PDF)
            </span>
            <label
              htmlFor="pdf-file-upload"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center gap-2 py-5 px-4 border border-dashed rounded-md cursor-pointer transition-colors focus-within:ring-1 focus-within:ring-accent focus-within:ring-offset-1 focus-within:ring-offset-root ${
                isDragging
                  ? "border-accent bg-accent-tint"
                  : "border-muted bg-root/60 hover:border-tertiary hover:bg-elevated/40"
              } ${loading ? "cursor-not-allowed opacity-50 pointer-events-none" : ""}`}
            >
              <input
                id="pdf-file-upload"
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                disabled={loading}
                className="sr-only"
              />
              <FilePlus2 className={`w-5 h-5 ${isDragging ? "text-accent" : "text-tertiary"}`} />
              <div className="text-center">
                <p className="text-xs text-primary font-medium">
                  <span className="text-accent underline underline-offset-2">Choose PDF files</span> or drag and drop
                </p>
                <p className="text-micro text-tertiary mt-0.5">Multiple PDFs supported · Up to 15 MB per file</p>
              </div>
            </label>
          </div>

          {/* ── Pending Upload Queue ── */}
          {selectedFiles.length > 0 && (
            <div className="border border-subtle rounded-md bg-root overflow-hidden">
              <div className="flex justify-between items-center px-3 py-2 bg-elevated border-b border-subtle">
                <span className="text-xs font-medium text-secondary">
                  Ready to index ({selectedFiles.length} {selectedFiles.length === 1 ? "file" : "files"})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-micro text-status-error hover:underline focus-ring"
                >
                  Clear all
                </button>
              </div>
              <ul className="max-h-36 overflow-y-auto divide-y divide-subtle text-xs">
                {selectedFiles.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between px-3 py-2 hover:bg-surface/50 transition">
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                      <span className="truncate text-primary font-mono text-micro" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                      <span className="text-tertiary font-mono text-micro tabular-nums">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-tertiary hover:text-status-error transition focus-ring"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Action Triggers with Inline Reset Confirmation ── */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-2.5 px-4 rounded-md font-semibold text-xs flex items-center justify-center gap-2 focus-ring interactive-button ${
                loading
                  ? "bg-accent-tint text-accent cursor-not-allowed border border-accent-border"
                  : "bg-accent hover:bg-accent-hover text-root"
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{loadingMessage || "Processing…"}</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>
                    {selectedFiles.length === 0 && indexedResumes.length > 0
                      ? "Save Job Description"
                      : "Index Candidates & Role"}
                  </span>
                </>
              )}
            </button>

            {confirmingReset ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="py-2.5 px-3 rounded-md text-xs font-semibold bg-status-error text-root hover:opacity-90 transition focus-ring"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  disabled={loading}
                  className="py-2.5 px-2.5 rounded-md text-xs text-secondary hover:text-primary border border-subtle hover:bg-elevated transition focus-ring"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                disabled={loading}
                className="py-2.5 px-3 rounded-md text-xs font-medium text-secondary hover:text-status-error hover:bg-status-error-bg border border-subtle hover:border-status-error-border transition interactive-button focus-ring flex items-center gap-1.5 justify-center"
                title="Clear all uploaded resumes and reset the vector store"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Pool</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </Panel>
  );
};

export default ResumeUploader;
