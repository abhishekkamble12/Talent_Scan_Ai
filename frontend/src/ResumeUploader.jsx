import React, { useState, useRef } from "react";
import axios from "axios";
import {
  Upload, FileText, CheckCircle, AlertCircle,
  RefreshCw, Sparkles, Trash2, Database, X, FilePlus2,
} from "lucide-react";

const BACKEND_URL = "http://127.0.0.1:5000";

const SAMPLE_JOB_DESCRIPTION = `Full Stack Software Engineer (React & Python)

About the Role:
We are looking for a proactive Full Stack Engineer to build scalable web applications. You will collaborate closely with cross-functional teams to design, develop, and deploy cloud-native software products.

Key Responsibilities:
- Build responsive, accessible front-end interfaces using React, TypeScript, and TailwindCSS.
- Develop robust RESTful APIs using Python (FastAPI / Flask / Django).
- Work with relational and vector databases (PostgreSQL, ChromaDB).
- Integrate LLM-powered services, Retrieval-Augmented Generation (RAG) pipelines, and intelligent search agents.
- Write unit, integration, and end-to-end tests to guarantee high code reliability.

Qualifications & Skills:
- 2+ years of professional software engineering experience.
- Strong proficiency in modern JavaScript/TypeScript, React, HTML5, and CSS.
- Proven backend development skills in Python and database schema design.
- Familiarity with Git, Docker, CI/CD pipelines, and cloud platforms (GCP or AWS).
- Problem-solving mindset and strong team communication skills.`;

const ResumeUploader = ({ onDataUpdated }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [alert, setAlert] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  /* ── File helpers ── */
  const addPdfs = (files) => {
    const pdfs = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length < files.length) {
      setAlert({ type: "error", message: "Non-PDF files were skipped. Only PDF resumes are accepted." });
    } else {
      setAlert(null);
    }
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...pdfs.filter((f) => !existing.has(f.name + f.size))];
    });
  };

  const handleFileChange = (e) => addPdfs(e.target.files || []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addPdfs(e.dataTransfer.files);
  };

  const removeFile = (idx) => setSelectedFiles((p) => p.filter((_, i) => i !== idx));

  /* ── Actions ── */
  const handleFillSampleJD = () => {
    setJobDescription(SAMPLE_JOB_DESCRIPTION);
    setAlert({ type: "success", message: "Sample JD loaded — feel free to edit it." });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFiles.length) {
      setAlert({ type: "error", message: "Please select at least one PDF resume." });
      return;
    }
    if (!jobDescription.trim()) {
      setAlert({ type: "error", message: "Please enter a Job Description." });
      return;
    }
    setLoading(true);
    setLoadingMessage("Parsing PDFs & indexing embeddings into ChromaDB…");
    setAlert(null);
    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append("resumes", f));
    formData.append("job_description", jobDescription);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAlert({ type: "success", message: res.data.message || `✓ Indexed ${selectedFiles.length} resumes.` });
      setSelectedFiles([]);
      onDataUpdated?.();
    } catch (err) {
      setAlert({ type: "error", message: err.response?.data?.error || "Upload failed. Is the backend running?" });
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleLoadSampleDemo = async () => {
    setLoading(true);
    setLoadingMessage("Loading 6 bundled sample resumes…");
    setAlert(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/load-sample`);
      setAlert({ type: "success", message: res.data.message || "Demo data loaded!" });
      if (res.data.job_description) setJobDescription(res.data.job_description);
      onDataUpdated?.();
    } catch (err) {
      setAlert({ type: "error", message: err.response?.data?.error || "Failed to load demo data." });
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset all uploaded resumes and clear the vector database?")) return;
    setLoading(true);
    setLoadingMessage("Clearing vector store…");
    setAlert(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/reset`);
      setAlert({ type: "success", message: res.data.message || "Database reset." });
      setSelectedFiles([]);
      setJobDescription("");
      onDataUpdated?.();
    } catch {
      setAlert({ type: "error", message: "Reset failed." });
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-sm flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-bold text-sm border border-indigo-500/30">
            1
          </span>
          <div>
            <h2 className="text-base font-semibold text-white leading-snug">Upload &amp; Job Context</h2>
            <p className="text-[11px] text-slate-400">Ingest resumes into ChromaDB with embeddings</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLoadSampleDemo}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all disabled:opacity-50"
          title="Load 6 pre-bundled sample resumes"
        >
          <Sparkles className="w-3.5 h-3.5" />
          1-Click Demo
        </button>
      </div>

      <div className="p-6 space-y-5 flex-1">

        {/* ── Alert ── */}
        {alert && (
          <div className={`flex items-start gap-2.5 p-3 rounded-xl text-sm border ${
            alert.type === "success"
              ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/50"
              : "bg-rose-950/50 text-rose-300 border-rose-800/50"
          }`}>
            {alert.type === "success"
              ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <span className="flex-1 text-xs leading-relaxed">{alert.message}</span>
            <button onClick={() => setAlert(null)} className="text-current opacity-50 hover:opacity-100 transition">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Job Description ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                Target Job Description
              </label>
              <button
                type="button"
                onClick={handleFillSampleJD}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition underline underline-offset-2"
              >
                Insert Sample JD
              </button>
            </div>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description or role requirements here…"
              rows={6}
              disabled={loading}
              className="w-full p-3 bg-slate-950/60 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/40 transition resize-none"
            />
          </div>

          {/* ── Drag-and-Drop Upload Zone ── */}
          <div>
            <label className="text-sm font-medium text-slate-200 mb-2 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-indigo-400" />
              Upload Candidate Resumes (PDF)
            </label>
            <div
              onClick={() => !loading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`mt-1.5 relative flex flex-col items-center justify-center gap-2 py-8 px-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                isDragging
                  ? "border-indigo-500 bg-indigo-500/8 scale-[1.01]"
                  : "border-slate-700 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-950/60"
              } ${loading ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileChange}
                disabled={loading}
                className="hidden"
              />
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDragging ? "bg-indigo-500/20" : "bg-slate-800"} transition`}>
                <FilePlus2 className={`w-5 h-5 ${isDragging ? "text-indigo-400" : "text-slate-400"}`} />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-indigo-400">Click to browse</span>{" "}
                  or drag &amp; drop PDFs
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Multiple PDFs · up to 50 MB total</p>
              </div>
            </div>
          </div>

          {/* ── File List ── */}
          {selectedFiles.length > 0 && (
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-3 py-2 border-b border-slate-800">
                <span className="text-xs font-semibold text-slate-300">
                  {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} ready
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-[11px] text-rose-400 hover:text-rose-300 transition"
                >
                  Clear all
                </button>
              </div>
              <ul className="max-h-36 overflow-y-auto divide-y divide-slate-800/60">
                {selectedFiles.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between px-3 py-2 hover:bg-slate-800/30 transition">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="truncate text-xs text-slate-300" title={file.name}>{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-slate-500 hover:text-rose-400 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                loading
                  ? "bg-indigo-700/50 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-500/20"
              }`}
            >
              {loading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
              ) : (
                <><Database className="w-4 h-4" /> Index Resumes &amp; JD</>
              )}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="py-2.5 px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/40 transition-all disabled:opacity-50 flex items-center gap-1.5 justify-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset All
            </button>
          </div>
        </form>
      </div>

      {/* ── Progress Banner ── */}
      {loading && (
        <div className="mx-6 mb-6 p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl flex items-center gap-3 text-xs text-indigo-300">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 flex-shrink-0" />
          <span>{loadingMessage}</span>
        </div>
      )}
    </div>
  );
};

export default ResumeUploader;
