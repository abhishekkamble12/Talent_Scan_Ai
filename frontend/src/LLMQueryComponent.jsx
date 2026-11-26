import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Panel, PanelHeader, Badge, EmptyState } from "./components/ui";
import {
  MessageSquare,
  Sparkles,
  Send,
  Copy,
  Check,
  Download,
  AlertCircle,
  RefreshCw,
  FileSearch,
  UploadCloud,
  History,
  ChevronRight,
} from "lucide-react";

import { BACKEND_URL } from "./api/client";
const HISTORY_STORAGE_KEY = "talentscan_query_history";

const PROMPT_CATALOG = [
  {
    category: "Shortlist",
    text: "Identify the top 3 candidates and explain why they fit this job description.",
  },
  {
    category: "Shortlist",
    text: "Create a skills comparison matrix for all candidates against the requirements.",
  },
  {
    category: "Technical",
    text: "Which candidates have strong React and Python backend experience?",
  },
  {
    category: "Gaps",
    text: "Highlight any critical skill gaps or missing qualifications across the candidates.",
  },
  {
    category: "Technical",
    text: "Generate 3 customized technical interview questions for each shortlisted candidate.",
  },
];

const CATEGORIES = ["All", "Shortlist", "Technical", "Gaps"];

const LLMQueryComponent = ({
  currentStatus,
  externalPrompt = "",
  onExternalPromptHandled,
  onQuerySuccess,
}) => {
  const [question, setQuestion] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [response, setResponse] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [recentHistory, setRecentHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const responseRef = useRef(null);
  const textareaRef = useRef(null);

  const hasResumes = Boolean(currentStatus?.resumes_count && currentStatus.resumes_count > 0);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(recentHistory));
    } catch {
      // Ignore storage quota errors
    }
  }, [recentHistory]);

  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [response]);

  const handleAsk = useCallback(async (q) => {
    const query = (q || question).trim();
    if (!query) return;
    setLoading(true);
    setError("");
    setResponse("");
    setActivePrompt(query);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/predict`, { question: query });
      if (res.data?.answer) {
        setResponse(res.data.answer);
        setRecentHistory((prev) => {
          const filtered = prev.filter((item) => item.question !== query);
          return [{ question: query, answer: res.data.answer }, ...filtered].slice(0, 5);
        });
        onQuerySuccess?.();
      } else {
        setError("No candidate evaluation was returned by the screening pipeline.");
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to reach the backend service. Please verify the API server is running."
      );
    } finally {
      setLoading(false);
    }
  }, [question, onQuerySuccess]);

  // Handle external prompt triggered from CandidatePool ("Screen Candidate")
  useEffect(() => {
    if (externalPrompt) {
      setQuestion(externalPrompt);
      handleAsk(externalPrompt);
      onExternalPromptHandled?.();
    }
  }, [externalPrompt, handleAsk, onExternalPromptHandled]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAsk(question);
  };

  const handleChipClick = (chipText) => {
    setQuestion(chipText);
    handleAsk(chipText);
  };

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (!response) return;
    const content = `# Candidate Screening Report\n\n**Query:** ${activePrompt}\n\n---\n\n${response}\n`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talentscan-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      handleAsk(question);
    }
  };

  const visiblePrompts =
    selectedCategory === "All"
      ? PROMPT_CATALOG
      : PROMPT_CATALOG.filter((p) => p.category === selectedCategory);

  return (
    <Panel className="flex flex-col relative">
      {/* ── Directional Progress Sweep ── */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-elevated overflow-hidden z-20">
          <div className="h-full bg-accent animate-sweep w-1/2" />
        </div>
      )}

      <PanelHeader
        icon={Sparkles}
        title="AI Screening Copilot"
        subtitle="Ask natural-language questions grounded in indexed resumes"
        action={
          <Badge variant="neutral" className="font-mono">
            Gemini Flash
          </Badge>
        }
      />

      <div className="p-5 flex flex-col gap-5 flex-1">
        {/* ── Categorized Screening Prompts ── */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-medium text-secondary">
              Screening Prompt Templates
            </span>
            <div className="flex items-center gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded-sm text-[11px] font-medium transition focus-ring ${
                    selectedCategory === cat
                      ? "bg-accent-tint text-accent border border-accent-border"
                      : "text-tertiary hover:text-secondary border border-transparent"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {visiblePrompts.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(item.text)}
                disabled={loading}
                className="text-left flex items-center justify-between gap-2 text-xs py-2 px-3 rounded-md text-secondary hover:text-primary bg-root/50 hover:bg-elevated border border-subtle hover:border-muted transition-all group disabled:opacity-50 interactive-button focus-ring"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronRight className="w-3.5 h-3.5 text-tertiary group-hover:text-accent flex-shrink-0 transition-colors" />
                  <span className="leading-snug truncate sm:whitespace-normal">{item.text}</span>
                </div>
                <span className="hidden sm:inline-block text-[10px] font-mono text-tertiary uppercase flex-shrink-0">
                  {item.category}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Query Input Form ── */}
        <div>
          <label htmlFor="screening-query-input" className="sr-only">
            Ask a screening question
          </label>
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              id="screening-query-input"
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about specific technical skills, years of experience, or candidate comparisons…"
              rows={3}
              disabled={loading}
              className="w-full p-3 pb-11 bg-root border border-subtle rounded-md text-primary placeholder:text-tertiary text-sm font-sans focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent transition resize-none leading-relaxed textarea-query-auto-grow"
            />
            <div className="absolute bottom-3 left-3 text-micro text-tertiary">
              Press <kbd className="font-mono px-1 py-0.5 rounded bg-elevated border border-subtle text-[11px]">Ctrl+Enter</kbd> to run
            </div>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className={`absolute right-2.5 bottom-2.5 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all focus-ring interactive-button ${
                loading || !question.trim()
                  ? "bg-elevated text-tertiary border border-subtle cursor-not-allowed opacity-60"
                  : "bg-accent hover:bg-accent-hover text-root"
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing…</span>
                </>
              ) : (
                <>
                  <span>Run Analysis</span>
                  <Send className="w-3 h-3" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Persisted Session History Pills ── */}
        {recentHistory.length > 0 && !loading && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="inline-flex items-center gap-1 text-micro text-tertiary flex-shrink-0">
              <History className="w-3 h-3" />
              <span>History:</span>
            </span>
            {recentHistory.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuestion(item.question);
                  setActivePrompt(item.question);
                  setResponse(item.answer);
                  setError("");
                }}
                className={`text-micro px-2.5 py-1 rounded-sm border truncate max-w-[180px] transition focus-ring flex-shrink-0 ${
                  activePrompt === item.question
                    ? "bg-accent-tint text-accent border-accent-border"
                    : "bg-elevated text-secondary border-subtle hover:text-primary"
                }`}
                title={item.question}
              >
                {item.question}
              </button>
            ))}
          </div>
        )}

        {/* ── Error Banner ── */}
        {error && (
          <div
            role="alert"
            className="p-3 rounded-md bg-status-error-bg text-status-error border border-status-error-border text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div className="py-10 flex flex-col items-center justify-center gap-2.5 border border-subtle rounded-md bg-root/40">
            <RefreshCw className="w-5 h-5 text-accent animate-spin" />
            <p className="text-xs text-secondary">
              Searching candidate vector store &amp; synthesizing evaluation…
            </p>
          </div>
        )}

        {/* ── Screening Synthesis Report ── */}
        {response && !loading && (
          <div
            ref={responseRef}
            className="rounded-md border border-subtle bg-root overflow-hidden border-l-2 border-l-accent"
          >
            <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-elevated border-b border-subtle gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary min-w-0">
                <FileSearch className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="truncate">Candidate Evaluation Report</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  className="flex items-center gap-1.5 text-micro font-medium text-secondary hover:text-primary px-2.5 py-1 rounded-sm bg-surface hover:bg-overlay border border-subtle transition interactive-button focus-ring"
                  title="Download report as Markdown"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export .md</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy candidate evaluation report"
                  className="flex items-center gap-1.5 text-micro font-medium text-secondary hover:text-primary px-2.5 py-1 rounded-sm bg-surface hover:bg-overlay border border-subtle transition interactive-button focus-ring"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-accent" />
                      <span className="text-accent">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Report</span>
                    </>
                  )}
                </button>
                <span className="sr-only" role="status" aria-live="polite">
                  {copied ? "Report copied to clipboard" : ""}
                </span>
              </div>
            </div>

            <div className="prose-custom max-h-[520px] overflow-y-auto p-5">
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* ── Contextual Empty States ── */}
        {!response && !loading && !error && (
          <EmptyState
            icon={hasResumes ? MessageSquare : UploadCloud}
            title={hasResumes ? "Ready to screen candidates" : "No candidate resumes indexed"}
            description={
              hasResumes
                ? `${currentStatus.resumes_count} candidate ${
                    currentStatus.resumes_count === 1 ? "resume is" : "resumes are"
                  } indexed. Choose a screening prompt above or ask a custom question.`
                : "Upload candidate PDFs or click 'Load Sample' in the Role & Candidate Pool panel to begin screening."
            }
          />
        )}
      </div>
    </Panel>
  );
};

export default LLMQueryComponent;
