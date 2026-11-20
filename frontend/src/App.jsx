import React, { useState, useEffect } from "react";
import axios from "axios";
import ResumeUploader from "./ResumeUploader";
import LLMQueryComponent from "./LLMQueryComponent";
import {
  Bot, Database, Key, Server, RefreshCw,
  Zap, Shield, Brain, ArrowRight, ChevronDown,
} from "lucide-react";

const BACKEND_URL = "http://127.0.0.1:5000";

/* ─── Feature pills shown in the hero ─── */
const FEATURES = [
  { icon: Brain,  label: "RAG-Powered AI",     color: "text-indigo-400" },
  { icon: Zap,    label: "Gemini Flash",       color: "text-amber-400"  },
  { icon: Database, label: "ChromaDB Vectors", color: "text-emerald-400"},
  { icon: Shield, label: "Privacy-first",      color: "text-sky-400"    },
];

const App = () => {
  const [status, setStatus] = useState({
    online: false,
    resumes_count: 0,
    has_job_description: false,
    api_key_configured: false,
  });
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);

  const fetchStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/status`, { timeout: 3000 });
      setStatus({
        online: true,
        resumes_count: res.data.resumes_count || 0,
        has_job_description: res.data.has_job_description || false,
        api_key_configured: res.data.api_key_configured || false,
      });
    } catch {
      setStatus({ online: false, resumes_count: 0, has_job_description: false, api_key_configured: false });
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#060b18] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/40">

      {/* ─── Animated background blobs ─── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 -right-24 w-[400px] h-[400px] rounded-full bg-emerald-600/8 blur-[100px] animate-pulse delay-1000" />
        <div className="absolute bottom-0 left-1/3 w-[350px] h-[350px] rounded-full bg-violet-600/8 blur-[90px] animate-pulse delay-500" />
      </div>

      {/* ─── Sticky Header ─── */}
      <header className="relative z-30 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">

          {/* Logo + Brand */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-float">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">TalentScan AI</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded-full">
                  RAG Screener
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Intelligent Resume Screening &amp; Candidate Analysis</p>
            </div>
          </div>

          {/* Status pills */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <StatusPill
              icon={Server}
              label={status.online ? "Backend Online" : "Backend Offline"}
              active={status.online}
              activeClass="bg-emerald-950/60 text-emerald-300 border-emerald-800/70"
              inactiveClass="bg-rose-950/60 text-rose-300 border-rose-800/70"
              dot
            />
            <StatusPill
              icon={Database}
              label={`${status.resumes_count} Resumes`}
              active
              activeClass="bg-slate-800/80 text-slate-300 border-slate-700"
              iconClass="text-indigo-400"
            />
            <StatusPill
              icon={Key}
              label={status.api_key_configured ? "API Key ✓" : "Key Needed"}
              active={status.api_key_configured}
              activeClass="bg-slate-800 text-slate-300 border-slate-700"
              inactiveClass="bg-amber-950/60 text-amber-300 border-amber-800/70"
              iconClass="text-amber-400"
            />
            <button
              onClick={fetchStatus}
              disabled={checkingStatus}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Banner ─── */}
      {heroVisible && (
        <div className="relative z-10 border-b border-slate-800/40 bg-gradient-to-b from-indigo-950/20 to-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-xs font-medium mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              AI-Powered Recruitment Intelligence
              <ArrowRight className="w-3 h-3" />
            </div>

            {/* Headline */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
              Screen candidates{" "}
              <span className="shimmer-text">10× faster</span>
              <br className="hidden sm:block" /> with Gemini + RAG
            </h2>

            <p className="max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed mb-7">
              Upload job descriptions and PDF resumes. TalentScan AI indexes them into a vector database
              and lets you ask natural-language screening questions — powered by Gemini 1.5 Flash.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 mb-7">
              {FEATURES.map(({ icon: Icon, label, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800 text-xs text-slate-300"
                >
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  {label}
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-6 text-center mb-6">
              {[
                { value: status.resumes_count || "0", label: "Indexed Resumes", color: "text-indigo-400" },
                { value: status.online ? "Live" : "Offline", label: "Backend Status", color: status.online ? "text-emerald-400" : "text-rose-400" },
                { value: "RAG", label: "Pipeline Mode", color: "text-amber-400" },
              ].map(({ value, label, color }) => (
                <div key={label}>
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Scroll-down collapse */}
            <button
              onClick={() => setHeroVisible(false)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition mt-1"
            >
              <ChevronDown className="w-4 h-4" />
              Jump to App
            </button>
          </div>
        </div>
      )}

      {/* ─── Offline Banner ─── */}
      {!status.online && (
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span>
                Backend not reachable. Start it with{" "}
                <code className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-amber-300">python backend\app.py</code>
                {" "}or{" "}
                <code className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-amber-300">start_project.bat</code>
              </span>
            </div>
            <button
              onClick={fetchStatus}
              className="shrink-0 px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ─── Main App Panels ─── */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <ResumeUploader onDataUpdated={fetchStatus} currentStatus={status} />
          <LLMQueryComponent currentStatus={status} />
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/40 py-5 text-center text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-1">
          {["React + Vite", "TailwindCSS", "LangChain", "ChromaDB", "Gemini Flash"].map((t, i, arr) => (
            <React.Fragment key={t}>
              <span>{t}</span>
              {i < arr.length - 1 && <span className="text-slate-700">·</span>}
            </React.Fragment>
          ))}
        </div>
        <p className="text-[11px] text-slate-600 mt-1">TalentScan AI · Resume Screening Pipeline</p>
      </footer>
    </div>
  );
};

/* ─── Reusable status pill ─── */
const StatusPill = ({ icon: Icon, label, active, activeClass, inactiveClass = "", iconClass = "", dot = false }) => (
  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${active ? activeClass : inactiveClass}`}>
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-rose-400"}`} />}
    <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
    <span>{label}</span>
  </div>
);

export default App;
