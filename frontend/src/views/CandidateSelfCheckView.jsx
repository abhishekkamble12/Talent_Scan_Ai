import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Sparkles,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Code2,
  Clock,
  ArrowRight,
  Briefcase,
  Layers,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ScoreRing } from "../components/ScoreRing";
import { Badge } from "../components/ui";
import { BACKEND_URL } from "../api/client";

export const CandidateSelfCheckView = ({ onBackToHome, initialJobId = null }) => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(initialJobId || "");
  const [file, setFile] = useState(null);
  const [customJd, setCustomJd] = useState("");
  const [useCustomJd, setUseCustomJd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/jobs`);
        const list = res.data.jobs || [];
        setJobs(list);
        if (list.length > 0 && !selectedJobId) {
          setSelectedJobId(list[0].id);
        }
      } catch (err) {
        console.warn("Failed loading jobs for self check:", err);
      }
    };
    fetchJobs();
  }, [selectedJobId]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        setError("Only PDF resumes are supported.");
        return;
      }
      setFile(f);
      setError("");
    }
  };

  const handleRunCheck = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select your resume PDF first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("resume", file);
    if (useCustomJd && customJd.trim()) {
      formData.append("job_description", customJd.trim());
    } else if (selectedJobId) {
      formData.append("job_id", selectedJobId);
    }

    try {
      const res = await axios.post(`${BACKEND_URL}/api/candidate-self-check`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to analyze resume. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const activeJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 sm:p-6">
      {/* Top Breadcrumb Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-subtle">
        <button
          type="button"
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Home
        </button>
        <span className="text-micro font-medium text-accent bg-accent-tint border border-accent-border px-2.5 py-0.5 rounded-full">
          Candidate Portal • Self-Service Audit
        </span>
      </div>

      {!result ? (
        /* Upload Form Screen */
        <div className="bg-surface border border-subtle rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" /> Benchmark Your Resume & Skill Gaps
            </h1>
            <p className="text-xs text-secondary mt-1 leading-relaxed">
              Upload your resume to check alignment with a role. Get an instant match breakdown,
              unbiased requirement citations, and an actionable roadmap with courses and projects to close any gaps.
            </p>
          </div>

          <form onSubmit={handleRunCheck} className="space-y-6">
            {/* Target Job Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-primary block">Target Role</label>
              {!useCustomJd ? (
                <div className="space-y-2">
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full px-3 py-2 bg-root border border-subtle rounded-lg text-xs text-primary focus:border-accent focus:outline-none"
                  >
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} ({j.candidates_count || 0} candidates)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setUseCustomJd(true)}
                    className="text-micro text-accent hover:underline inline-block"
                  >
                    + Or paste a custom job description
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    value={customJd}
                    onChange={(e) => setCustomJd(e.target.value)}
                    placeholder="Paste the target job description requirements here…"
                    className="w-full p-3 bg-root border border-subtle rounded-lg text-xs text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setUseCustomJd(false)}
                    className="text-micro text-secondary hover:underline inline-block"
                  >
                    ← Back to selecting existing job
                  </button>
                </div>
              )}
            </div>

            {/* Resume Upload Area */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-primary block">Your Resume (PDF)</label>
              <label
                htmlFor="selfcheck-upload"
                className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed cursor-pointer transition ${
                  file
                    ? "border-accent bg-accent-tint/10"
                    : "border-subtle bg-root hover:border-tertiary"
                }`}
              >
                <Upload className="w-8 h-8 text-accent mb-2" />
                <span className="text-xs font-medium text-primary">
                  {file ? file.name : "Click to select or drag & drop resume PDF"}
                </span>
                <span className="text-micro text-tertiary mt-1">PDF format up to 15MB</span>
                <input
                  id="selfcheck-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-danger-tint border border-danger-border text-danger text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file}
              className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm ${
                loading || !file
                  ? "bg-surface-hover text-tertiary cursor-not-allowed border border-subtle"
                  : "bg-accent hover:bg-accent-hover text-white cursor-pointer"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing Resume Alignment…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Run AI Match & Upskilling Audit
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Results View */
        <div className="space-y-6">
          {/* Top Scorecard Summary */}
          <div className="bg-surface border border-subtle rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center sm:text-left">
                <span className="text-micro font-medium uppercase text-tertiary tracking-wider">
                  Self-Check Analysis for {result.job_title}
                </span>
                <h2 className="text-xl font-bold text-primary">
                  {result.candidate?.name || "Your Candidate Profile"}
                </h2>
                <p className="text-xs text-secondary leading-relaxed max-w-xl">
                  {result.upskilling_plan?.coaching_summary ||
                    result.candidate?.summary ||
                    "Here is your personalized match breakdown and upskilling roadmap."}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center p-4 bg-root border border-subtle rounded-xl min-w-[130px]">
                <ScoreRing score={result.candidate?.fit_score || 0} size={72} strokeWidth={6} />
                <span className="text-micro font-semibold text-secondary mt-1">Match Score</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-subtle flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setFile(null);
                }}
                className="text-xs text-secondary hover:text-primary transition inline-flex items-center gap-1.5"
              >
                ← Test Another Resume
              </button>

              <span className="text-micro text-tertiary">
                {result.upskilling_plan?.total_gaps_identified || 0} skill growth opportunities identified
              </span>
            </div>
          </div>

          {/* Upskilling Roadmap Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent" /> Recommended Upskilling Roadmap
            </h3>

            {result.upskilling_plan?.roadmap_items?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.upskilling_plan.roadmap_items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-xl bg-surface border border-subtle space-y-3.5 hover:border-tertiary transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`text-micro font-medium uppercase px-2 py-0.5 rounded ${
                            item.category === "must_have"
                              ? "bg-danger-tint text-danger border border-danger-border"
                              : "bg-warning-tint text-warning border border-warning-border"
                          }`}
                        >
                          {item.priority}
                        </span>
                        <h4 className="text-sm font-bold text-primary mt-1.5">{item.skill}</h4>
                      </div>
                      <div className="flex items-center gap-1 text-micro text-tertiary shrink-0">
                        <Clock className="w-3.5 h-3.5" /> {item.time_to_close}
                      </div>
                    </div>

                    {/* Courses */}
                    <div className="space-y-1">
                      <span className="text-micro font-semibold text-tertiary uppercase flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-accent" /> Recommended Learning:
                      </span>
                      <ul className="text-xs text-secondary space-y-1 list-disc list-inside">
                        {item.courses?.map((c, cIdx) => (
                          <li key={cIdx} className="leading-relaxed">
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Practice Project */}
                    <div className="p-3 rounded-lg bg-root border border-subtle space-y-1">
                      <span className="text-micro font-semibold text-accent uppercase flex items-center gap-1">
                        <Code2 className="w-3 h-3" /> Portfolio Project:
                      </span>
                      <p className="text-xs text-primary leading-relaxed">
                        {item.practice_project}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-surface border border-subtle rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
                <h4 className="text-sm font-semibold text-primary">No Skill Gaps Detected!</h4>
                <p className="text-xs text-secondary max-w-md mx-auto">
                  Your resume demonstrates strong alignment with all evaluated role requirements.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
