import React, { useState, useRef } from "react";
import axios from "axios";
import { UploadCloud, FileCode, CheckCircle2, AlertCircle, X, RefreshCw, Sparkles } from "lucide-react";
import { BACKEND_URL } from "../api/client";

export const BulkUploadModal = ({
  jobId,
  isOpen,
  onClose,
  onUploadAndScreenComplete,
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [source, setSource] = useState("direct_upload");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [screening, setScreening] = useState(false);
  const [screenProgress, setScreenProgress] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFiles = (files) => {
    const pdfs = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length < files.length) {
      setError("Non-PDF files were skipped. Only PDF resumes are supported.");
    } else {
      setError("");
    }
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...pdfs.filter((f) => !existing.has(f.name + f.size))];
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleUploadAndAutoScreen = async () => {
    if (!selectedFiles.length) {
      setError("Please select at least one PDF resume to upload.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // 1. Bulk upload to POST /api/jobs/{id}/candidates with source tracking
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append("resumes", f));
      formData.append("source", source);

      await axios.post(`${BACKEND_URL}/api/jobs/${jobId}/candidates`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploading(false);
      setScreening(true);
      setScreenProgress({ percent: 10, message: "Starting AI screening pipeline…" });

      // 2. Trigger automated screening stream POST /api/jobs/{id}/screen
      const sseRes = await fetch(`${BACKEND_URL}/api/jobs/${jobId}/screen`, {
        method: "POST",
      });

      if (!sseRes.ok || !sseRes.body) {
        throw new Error("Screening SSE connection failed.");
      }

      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            try {
              const data = JSON.parse(trimmed.slice(5).trim());
              if (data.done) {
                setScreenProgress({ percent: 100, message: "Screening complete!" });
                setTimeout(() => {
                  onUploadAndScreenComplete?.();
                  onClose();
                }, 800);
              } else if (data.progress_percent !== undefined) {
                setScreenProgress({
                  percent: data.progress_percent,
                  message: `Screened ${data.candidate_name || "candidate"}: ${data.fit_score}% (${data.current}/${data.total})`,
                });
              }
            } catch (pErr) {
              // Ignore partial frames
            }
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed uploading and screening resumes.");
      setUploading(false);
      setScreening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg bg-surface border border-subtle rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-subtle bg-elevated/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-primary">Bulk Resume Ingestion</h3>
            <p className="text-xs text-secondary mt-0.5">
              Upload candidate PDFs. Screening against requirements runs automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading || screening}
            className="p-1 rounded text-tertiary hover:text-primary transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Screening Progress Bar */}
          {screening && screenProgress && (
            <div className="p-4 rounded-lg bg-accent-tint/40 border border-accent-border/50 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-accent flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>AI Auto-Screening in Progress</span>
                </span>
                <span className="font-mono text-primary tabular-nums">{screenProgress.percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-root overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300 ease-out"
                  style={{ width: `${screenProgress.percent}%` }}
                />
              </div>
              <p className="text-micro font-mono text-secondary truncate">{screenProgress.message}</p>
            </div>
          )}

          {/* Source Channel Selector */}
          {!screening && (
            <div className="flex items-center justify-between text-xs bg-root/60 p-2.5 rounded-lg border border-subtle">
              <label htmlFor="candidate-source-select" className="text-secondary font-medium">Candidate Source Channel:</label>
              <select
                id="candidate-source-select"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="bg-surface border border-subtle text-primary rounded-md px-2.5 py-1 text-xs focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="direct_upload">Direct Upload</option>
                <option value="referral">Internal Referral</option>
                <option value="linkedin">LinkedIn Recruiter</option>
                <option value="career_portal">Career Portal</option>
                <option value="agency">Agency / Headhunter</option>
              </select>
            </div>
          )}

          {/* Dropzone */}
          {!screening && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                isDragging
                  ? "border-accent bg-accent-tint"
                  : "border-subtle bg-root/50 hover:border-tertiary hover:bg-elevated/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={(e) => handleFiles(e.target.files || [])}
                className="sr-only"
              />
              <UploadCloud className={`w-8 h-8 ${isDragging ? "text-accent" : "text-tertiary"}`} />
              <div className="text-center">
                <p className="text-xs font-semibold text-primary">
                  <span className="text-accent underline underline-offset-2">Click to browse</span> or drag and drop PDFs
                </p>
                <p className="text-micro text-tertiary mt-0.5">Bulk upload up to 25 resumes at once</p>
              </div>
            </div>
          )}

          {/* Selected File List */}
          {selectedFiles.length > 0 && !screening && (
            <div className="border border-subtle rounded-md bg-root overflow-hidden">
              <div className="px-3 py-2 bg-elevated/50 border-b border-subtle flex items-center justify-between text-xs">
                <span className="font-medium text-secondary">
                  Ready to ingest ({selectedFiles.length} {selectedFiles.length === 1 ? "file" : "files"})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  disabled={uploading}
                  className="text-micro text-rose-400 hover:underline"
                >
                  Clear all
                </button>
              </div>
              <ul className="max-h-40 overflow-y-auto divide-y divide-subtle text-xs">
                {selectedFiles.map((f, i) => (
                  <li key={i} className="px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                      <span className="font-mono text-micro text-primary truncate">{f.name}</span>
                    </div>
                    <span className="text-tertiary text-micro font-mono">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-subtle bg-elevated/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading || screening}
            className="px-3 py-1.5 rounded-md border border-subtle text-xs text-secondary hover:text-primary transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUploadAndAutoScreen}
            disabled={uploading || screening || selectedFiles.length === 0}
            className="px-4 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-root font-semibold text-xs flex items-center gap-2 transition interactive-button focus-ring"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading &amp; Indexing…</span>
              </>
            ) : screening ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Screening Resumes…</span>
              </>
            ) : (
              <span>Upload &amp; Auto-Screen ({selectedFiles.length})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkUploadModal;
