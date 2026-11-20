import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import {
  MessageSquare, Sparkles, Send, Copy, Check,
  AlertCircle, RefreshCw, Lightbulb, ChevronRight,
} from "lucide-react";

const BACKEND_URL = "http://127.0.0.1:5000";

const SUGGESTED_QUERIES = [
  "Identify the top 3 candidates and explain why they fit this job description.",
  "Create a skills comparison matrix for all candidates against the requirements.",
  "Which candidates have strong React and Python backend experience?",
  "Highlight any critical skill gaps or missing qualifications across the candidates.",
  "Generate 3 customized technical interview questions for each shortlisted candidate.",
];

const LLMQueryComponent = ({ currentStatus }) => {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const responseRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [response]);

  const handleAsk = async (q) => {
    const query = (q || question).trim();
    if (!query) return;
    setLoading(true);
    setError("");
    setResponse("");
    try {
      const res = await axios.post(`${BACKEND_URL}/api/predict`, { question: query });
      if (res.data?.answer) {
        setResponse(res.data.answer);
      } else {
        setError("No response received from the screening pipeline.");
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not connect to backend. Make sure the Flask server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAsk(question);
  };

  const handleChipClick = (chip) => {
    setQuestion(chip);
    handleAsk(chip);
  };

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAsk(question);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-sm flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 font-bold text-sm border border-emerald-500/30">
            2
          </span>
          <div>
            <h2 className="text-base font-semibold text-white leading-snug">AI HR Screener</h2>
            <p className="text-[11px] text-slate-400">Ask questions against indexed resumes &amp; job context</p>
          </div>
        </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Gemini Flash</span>
          </div>
      </div>

      <div className="p-6 flex flex-col gap-5 flex-1">

        {/* ── Suggested chips ── */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium">Recommended questions</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {SUGGESTED_QUERIES.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(chip)}
                disabled={loading}
                className="text-left flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 hover:border-indigo-500/40 transition-all group disabled:opacity-50"
              >
                <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 flex-shrink-0 mt-0.5 transition-colors" />
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* ── Input ── */}
        <div>
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="E.g., Compare the candidates' cloud platform experience…"
              rows={3}
              disabled={loading}
              className="w-full p-3 pb-10 bg-slate-950/60 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition resize-none"
            />
            <div className="absolute bottom-2.5 left-3 text-[10px] text-slate-600">
              Ctrl+Enter to send
            </div>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className={`absolute right-2.5 bottom-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                loading || !question.trim()
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/40"
              }`}
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><span>Ask</span><Send className="w-3 h-3" /></>}
            </button>
          </form>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/50 text-rose-300 border border-rose-800/50 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="py-8 flex flex-col items-center gap-3 border border-dashed border-slate-800 rounded-xl">
            <div className="flex items-center gap-2">
              {["bg-emerald-400", "bg-indigo-400", "bg-amber-400"].map((c, i) => (
                <span key={i} className={`w-2.5 h-2.5 rounded-full ${c} animate-bounce`} style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center max-w-xs">
              Retrieving context from ChromaDB &amp; synthesizing insights with Gemini…
            </p>
          </div>
        )}

        {/* ── Response ── */}
        {response && !loading && (
          <div ref={responseRef} className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            {/* response header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                Screening Analysis
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
              >
                {copied ? <><Check className="w-3 h-3 text-emerald-400" /><span>Copied!</span></> : <><Copy className="w-3 h-3" /><span>Copy</span></>}
              </button>
            </div>
            {/* response body */}
            <div className="prose-custom max-h-[400px] overflow-y-auto p-4 text-xs leading-relaxed">
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!response && !loading && !error && (
          <div className="py-10 text-center border border-dashed border-slate-800 rounded-xl">
            <MessageSquare className="w-9 h-9 mx-auto mb-3 text-slate-700" />
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Select a suggested question above or type a custom screening query to get AI-powered insights.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default LLMQueryComponent;
