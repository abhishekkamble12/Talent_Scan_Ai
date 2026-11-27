import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, Copy, Check, Download, AlertCircle, RefreshCw, MessageSquare } from "lucide-react";
import { BACKEND_URL } from "../api/client";

const SUGGESTED_CHIPS = [
  "Identify top 3 candidates and explain why they fit this job's must-haves.",
  "Which candidate has the deepest Python and API scaling background?",
  "Summarize the main skill gaps across the entire candidate pool.",
  "Generate 3 customized interview questions for the top candidate.",
];

export const AskAIView = ({ job, candidates = [], onOpenCandidateDrawer }) => {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const responseRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [response]);

  const handleAsk = useCallback(async (q) => {
    const query = (q || question).trim();
    if (!query) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError("");
    setResponse("");

    let accumulatedAnswer = "";

    try {
      const sseRes = await fetch(`${BACKEND_URL}/api/predict/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: query,
          job_id: job?.id,
          job_description: job?.description,
        }),
        signal: controller.signal,
      });

      if (!sseRes.ok || !sseRes.body) {
        // Fallback to synchronous endpoint
        const syncRes = await axios.post(`${BACKEND_URL}/api/predict`, {
          question: query,
          job_id: job?.id,
          job_description: job?.description,
        });
        if (syncRes.data?.answer) {
          setResponse(syncRes.data.answer);
        } else {
          setError("No response returned.");
        }
        return;
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
              if (data.token) {
                accumulatedAnswer += data.token;
                setResponse((prev) => prev + data.token);
              } else if (data.done && data.answer) {
                setResponse(data.answer);
              } else if (data.error) {
                setError(data.error);
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Failed to query AI copilot.");
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  }, [question, job]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAsk(question);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Scope Banner */}
      <div className="p-4 rounded-lg bg-surface border border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>Scoped AI Recruiter Copilot</span>
          </h3>
          <p className="text-xs text-secondary mt-0.5">
            Querying against <strong className="text-primary font-semibold">{job?.title}</strong> ({candidates.length} candidates in pool).
          </p>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="space-y-1.5">
        <span className="text-micro font-mono uppercase tracking-wider text-tertiary">Quick Queries:</span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_CHIPS.map((chip, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQuestion(chip);
                handleAsk(chip);
              }}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-md bg-elevated hover:bg-overlay border border-subtle text-secondary hover:text-primary transition focus-ring text-left"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a technical or comparative question about these candidates…"
          rows={3}
          disabled={loading}
          className="w-full p-3.5 pb-11 bg-root border border-subtle rounded-lg text-primary placeholder:text-tertiary text-xs font-sans focus-visible:outline-none focus-visible:border-accent"
        />
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          {loading ? (
            <button
              type="button"
              onClick={handleStop}
              className="px-3 py-1 rounded-md bg-rose-500 text-white font-semibold text-xs hover:opacity-90 transition"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!question.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-root font-semibold text-xs transition disabled:opacity-50"
            >
              <span>Ask AI</span>
              <Send className="w-3 h-3" />
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Response Box */}
      {response && (
        <div ref={responseRef} className="rounded-lg border border-subtle bg-surface overflow-hidden">
          <div className="px-4 py-2.5 bg-elevated border-b border-subtle flex items-center justify-between">
            <span className="text-xs font-semibold text-primary flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-accent" />
              <span>Grounded AI Synthesis</span>
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-micro text-secondary hover:text-primary transition"
            >
              {copied ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <div className="p-5 prose prose-invert max-w-none text-xs leading-relaxed max-h-[500px] overflow-y-auto">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default AskAIView;
