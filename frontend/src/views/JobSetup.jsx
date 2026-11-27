import React, { useState } from "react";
import axios from "axios";
import { Sparkles, FileText, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { BACKEND_URL } from "../api/client";

const SAMPLE_JD = `Senior Backend Engineer (Python & Cloud Architecture)

About the Role:
We are looking for a Senior Backend Engineer to design, build, and scale resilient microservices and distributed data pipelines. You will collaborate directly with machine learning and frontend teams to deliver low-latency APIs.

Key Responsibilities:
- Design and maintain production REST and asynchronous APIs using Python (FastAPI, Flask) and PostgreSQL.
- Build containerized microservices deployed via Docker and Kubernetes on AWS or GCP.
- Manage relational and vector databases (PostgreSQL, ChromaDB, Redis caching).
- Implement robust CI/CD deployment pipelines, automated tests, and monitoring.
- Collaborate on RAG and LLM workflow integrations.

Qualifications:
- 4+ years of professional backend engineering experience in Python.
- Hands-on expertise with Docker, Kubernetes, and cloud infrastructure (AWS/GCP).
- Strong proficiency in relational database schema design, indexing, and SQL optimization.
- Familiarity with CI/CD tools (GitHub Actions, GitLab CI) and Git workflows.
- Nice to have: Experience with LLM integrations, embeddings, or React frontend familiarity.`;

export const JobSetup = ({ onJobCreated, onCancel }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFillSample = () => {
    setTitle("Senior Backend Engineer (Python & Cloud)");
    setDescription(SAMPLE_JD);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please paste a job description.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${BACKEND_URL}/api/jobs`, {
        title: title.trim() || undefined,
        description: description.trim(),
      });
      onJobCreated?.(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create job workspace.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-10 h-10 rounded-xl bg-accent-tint border border-accent-border flex items-center justify-center text-accent mx-auto">
          <Sparkles className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-primary tracking-tight">Create Job Workspace</h1>
        <p className="text-xs text-secondary max-w-md mx-auto leading-relaxed">
          Paste your Job Description. Our AI automatically extracts role criteria into editable{" "}
          <strong className="text-primary font-semibold">Must-Have</strong> and{" "}
          <strong className="text-primary font-semibold">Nice-to-Have</strong> chips.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 rounded-xl bg-surface border border-subtle space-y-5 shadow-lg">
        {error && (
          <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Job Title */}
        <div className="space-y-1.5">
          <label htmlFor="job-title-input" className="text-xs font-semibold text-primary block">
            Role Title (Optional)
          </label>
          <input
            id="job-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Backend Engineer (or let AI infer from text)"
            disabled={loading}
            className="w-full px-3 py-2 bg-root border border-subtle rounded-md text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent"
          />
        </div>

        {/* Job Description Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="job-description-area" className="text-xs font-semibold text-primary block">
              Job Description
            </label>
            <button
              type="button"
              onClick={handleFillSample}
              disabled={loading}
              className="text-xs text-accent hover:underline"
            >
              Use engineering sample
            </button>
          </div>
          <textarea
            id="job-description-area"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste role responsibilities, qualifications, and required tech stack…"
            rows={10}
            disabled={loading}
            className="w-full p-3.5 bg-root border border-subtle rounded-md text-xs text-primary placeholder:text-tertiary font-sans leading-relaxed focus-visible:outline-none focus-visible:border-accent resize-y"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-md border border-subtle text-xs text-secondary hover:text-primary transition"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !description.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-accent hover:bg-accent-hover text-root font-semibold text-xs transition interactive-button focus-ring disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Extracting Requirements with AI…</span>
              </>
            ) : (
              <>
                <span>Extract Requirements &amp; Create Job</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default JobSetup;
