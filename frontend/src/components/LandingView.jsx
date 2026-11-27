import { useState, useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Command,
  FileText,
  Search,
  Activity,
  Database,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  Layers,
  Briefcase,
} from "lucide-react";

const WORKBENCH_SCENARIOS = [
  {
    id: "shortlist",
    label: "Ranked Shortlist",
    query: "Auto-screened 6 candidates against Full Stack Software Engineer (React & Python)",
    latency: "1.4s",
    chunks: "6 candidates scored",
    results: [
      {
        name: "Aaryan Palve",
        score: "87% Fit",
        badge: "6/7 Must-Haves ✓✓✓✓✓✓✗",
        summary: "Strong Python, Flask/FastAPI, and React background. Missing Kubernetes production exposure.",
      },
      {
        name: "Rushikesh Kulkarni",
        score: "81% Fit",
        badge: "5/7 Must-Haves ✓✓✓✓✓✗✗",
        summary: "Solid PostgreSQL, Python, and ML engineering. Missing Docker and CI/CD pipeline ownership.",
      },
      {
        name: "Piyush Choudhari",
        score: "76% Fit",
        badge: "5/7 Must-Haves ✓✓✓✓✓✗✗",
        summary: "FastAPI, Docker, and CI/CD experience verified. Limited TypeScript frontend projects.",
      },
    ],
  },
  {
    id: "evidence",
    label: "Evidence Citations",
    query: "Auditable quote extraction with exact PDF page citations",
    latency: "Verified",
    chunks: "10 criteria checked",
    results: [
      {
        name: "React & TypeScript Interfaces",
        score: "✓ MET · p.1",
        badge: "High Confidence",
        summary: '"Developed a dynamic, React-based cybersecurity dashboard with TailwindCSS…" — Aaryan Palve, Page 1',
      },
      {
        name: "Python REST & Async APIs",
        score: "✓ MET · p.1",
        badge: "High Confidence",
        summary: '"Built FastAPI and Flask microservices handling automated document workflows…" — Piyush Choudhari, Page 1',
      },
      {
        name: "Kubernetes Orchestration",
        score: "✗ MISSING",
        badge: "Gap Flagged",
        summary: "No explicit Kubernetes or Helm deployment evidence found across indexed resume pages.",
      },
    ],
  },
  {
    id: "matrix",
    label: "Compare Matrix",
    query: "Side-by-side comparison across top 3 shortlisted candidates",
    latency: "Instant",
    chunks: "Differences highlighted",
    results: [
      {
        name: "Python & FastAPI / Flask",
        score: "3 / 3 Match",
        badge: "All Meet",
        summary: "Aaryan (✓ p.1), Rushikesh (✓ p.1), and Piyush (✓ p.1) all demonstrate backend Python APIs.",
      },
      {
        name: "Docker & CI/CD Pipelines",
        score: "1 / 3 Match",
        badge: "Key Differentiator",
        summary: "Piyush (✓ p.1) meets containerization & CI/CD; Aaryan (◐ p.2) partial; Rushikesh (✗) missing.",
      },
      {
        name: "Vector DBs & RAG Integration",
        score: "2 / 3 Match",
        badge: "Key Differentiator",
        summary: "Piyush (✓ p.1) and Nidhish (✓ p.1) list LangChain/RAG pipelines in production projects.",
      },
    ],
  },
];

const PIPELINE_PILLARS = [
  {
    icon: Briefcase,
    title: "1. Job-Centric Workspaces",
    description:
      "Paste any Job Description and AI extracts editable Must-Have and Nice-to-Have criteria chips so you control exactly what gets scored.",
  },
  {
    icon: Database,
    title: "2. Auto-Screen on Upload",
    description:
      "Bulk drag-and-drop PDF resumes. Parsing, ChromaDB vector indexing, and structured candidate scoring run automatically with live progress.",
  },
  {
    icon: ShieldCheck,
    title: "3. Auditable Evidence & Decisions",
    description:
      "Inspect exact verbatim quotes with PDF page numbers, compare 2–4 candidates side-by-side, shortlist with notes, and export CSV reports.",
  },
];

const LandingView = ({
  status,
  onNavigate,
  onOpenCommandPalette,
  onLoadSample,
  loadingSample = false,
  theme = "dark",
  onToggleTheme,
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState("shortlist");
  const [scrolled, setScrolled] = useState(false);

  const activeScenario =
    WORKBENCH_SCENARIOS.find((s) => s.id === activeScenarioId) || WORKBENCH_SCENARIOS[0];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 16);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-root text-primary hero-atmosphere flex flex-col">
      {/* Top Navigation Bar */}
      <header
        className={`sticky top-0 z-30 transition-colors duration-200 ${
          scrolled
            ? "bg-root/85 backdrop-blur-md border-b border-subtle"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2 text-base sm:text-lg font-bold tracking-tight text-primary focus-ring rounded-sm"
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" />
            <span>TalentScan AI</span>
          </button>

          <nav aria-label="Homepage Navigation" className="hidden md:flex items-center gap-7 text-sm font-medium">
            <button
              type="button"
              onClick={() => onNavigate("candidates")}
              className="text-secondary hover:text-primary transition-colors focus-ring rounded-sm"
            >
              Screening
            </button>
            <button
              type="button"
              onClick={() => onNavigate("jobs")}
              className="text-secondary hover:text-primary transition-colors focus-ring rounded-sm"
            >
              Job Openings
            </button>
            <button
              type="button"
              onClick={() => onNavigate("aiops")}
              className="text-secondary hover:text-primary transition-colors focus-ring rounded-sm"
            >
              Insights
            </button>
            <button
              type="button"
              onClick={() => onNavigate("settings")}
              className="text-secondary hover:text-primary transition-colors focus-ring rounded-sm"
            >
              Settings
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                className="p-2 rounded-md text-secondary hover:text-primary bg-surface/80 border border-subtle transition-colors focus-ring"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="Open command palette"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-secondary hover:text-primary bg-surface/80 border border-subtle transition-colors focus-ring"
            >
              <Command className="w-3.5 h-3.5 text-tertiary" />
              <kbd className="font-mono text-xs text-tertiary">Ctrl+K</kbd>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("candidates")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-root text-xs sm:text-sm font-semibold transition-colors interactive-button focus-ring"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-12 sm:pt-18 pb-16 sm:pb-24">
          <div className="max-w-4xl mx-auto text-center space-y-6 hero-enter">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-tint border border-accent-border text-accent text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Job-Centric · Ranked Shortlists · Page-Cited Evidence</span>
            </div>

            <h1
              tabIndex={-1}
              className="font-bold text-primary tracking-[-0.035em] leading-[1.02] outline-none"
              style={{ fontSize: "clamp(2.25rem, 1.3rem + 3.8vw, 4.4rem)" }}
            >
              Screen engineering candidates with auditable evidence.
            </h1>

            <p className="text-sm sm:text-base text-secondary leading-relaxed max-w-2xl mx-auto">
              Create a job workspace, upload PDF resumes, and get an instant ranked shortlist—complete with must-have breakdowns, verbatim page citations, side-by-side comparison, and Blind Mode.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onLoadSample}
                disabled={loadingSample}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-accent hover:bg-accent-hover text-root text-sm font-semibold transition-colors interactive-button focus-ring"
              >
                <Sparkles className={`w-4 h-4 ${loadingSample ? "animate-spin" : ""}`} />
                <span>{loadingSample ? "Loading Demo Workspace…" : "Try 1-Click Demo"}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("job-create")}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-surface hover:bg-elevated text-primary border border-subtle text-sm font-semibold transition-colors interactive-button focus-ring"
              >
                <span>Create New Job</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("self-check")}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-root hover:bg-surface text-secondary hover:text-primary border border-subtle text-sm font-medium transition-colors interactive-button focus-ring"
              >
                <span>Candidate Self-Check & Roadmap</span>
              </button>
            </div>
          </div>

          {/* Wide Interactive Screening Stage */}
          <div className="mt-12 sm:mt-16 max-w-5xl mx-auto hero-enter-delay">
            <div className="rounded-xl border border-subtle bg-surface/95 shadow-2xl overflow-hidden">
              {/* Stage Header with Connected Segmented Toggle */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-subtle bg-elevated/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-primary">
                  <Layers className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Interactive Workspace Preview</span>
                </div>

                <div
                  role="tablist"
                  aria-label="Sample screening views"
                  className="inline-flex p-0.5 rounded-md bg-root border border-subtle"
                >
                  {WORKBENCH_SCENARIOS.map((scenario) => {
                    const isSelected = scenario.id === activeScenario.id;
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => setActiveScenarioId(scenario.id)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors focus-ring ${
                          isSelected
                            ? "bg-elevated text-primary shadow-xs"
                            : "text-secondary hover:text-primary"
                        }`}
                      >
                        {scenario.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Context Bar */}
              <div className="px-4 sm:px-6 py-3 border-b border-subtle bg-root/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-primary min-w-0">
                  <Search className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="truncate">{activeScenario.query}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-tertiary tabular-nums flex-shrink-0 font-mono">
                  <span>{activeScenario.chunks}</span>
                  <span className="text-accent font-medium">{activeScenario.latency}</span>
                </div>
              </div>

              {/* Preview Results List */}
              <div className="divide-y divide-subtle">
                {activeScenario.results.map((item) => (
                  <div
                    key={item.name}
                    className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-6 hover:bg-elevated/35 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="text-sm font-semibold text-primary truncate">
                          {item.name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-elevated border border-subtle text-[11px] font-mono text-secondary">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-secondary leading-relaxed pl-6">
                        {item.summary}
                      </p>
                    </div>
                    <div className="pl-6 sm:pl-0 flex-shrink-0 text-left sm:text-right">
                      <span className="text-sm font-semibold text-accent tabular-nums font-mono">
                        {item.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stage Footer */}
              <div className="px-4 sm:px-6 py-3 border-t border-subtle bg-elevated/30 flex flex-wrap items-center justify-between gap-3 text-xs text-secondary">
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${status.online ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {status.online
                    ? `Backend connected · ${status.jobs_count || 0} active jobs · ${status.resumes_count} indexed resumes`
                    : "Start the FastAPI server to run live screening against your own PDFs"}
                </span>
                <button
                  type="button"
                  onClick={onLoadSample}
                  disabled={loadingSample}
                  className="inline-flex items-center gap-1.5 text-accent hover:text-accent-hover font-semibold transition-colors focus-ring rounded-sm"
                >
                  <span>{loadingSample ? "Loading Demo…" : "Launch 1-Click Demo"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section className="border-t border-subtle bg-surface/40">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
            <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight leading-tight">
                Recruiters think in ranked lists and evidence—not chat boxes.
              </h2>
              <p className="text-sm text-secondary leading-relaxed max-w-prose">
                Every candidate is scored deterministically against your Must-Have and Nice-to-Have criteria, with verbatim PDF quotes and page citations so hiring managers trust every decision.
              </p>
            </div>

            <div className="lg:col-span-7 divide-y divide-subtle border-y border-subtle">
              {PIPELINE_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div key={pillar.title} className="py-7 flex items-start gap-4">
                    <div className="w-9 h-9 rounded-md bg-elevated border border-subtle flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold text-primary">{pillar.title}</h3>
                      <p className="text-sm text-secondary leading-relaxed max-w-prose">
                        {pillar.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Observability & Telemetry Band */}
        <section className="border-t border-subtle">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight leading-tight">
                Built-in AIOps observability for every query.
              </h2>
              <p className="text-sm text-secondary leading-relaxed max-w-prose">
                Track P50 and P95 latency, vector similarity scores, token costs, and automated LLM-as-a-judge ratings in the Insights dashboard.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate("aiops")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-elevated hover:bg-overlay text-primary border border-subtle text-sm font-medium transition-colors interactive-button focus-ring"
                >
                  <Activity className="w-4 h-4 text-accent" />
                  <span>Inspect Insights Dashboard</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-lg border border-subtle bg-surface divide-y divide-subtle">
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-sm text-secondary">Median End-to-End Latency</span>
                <span className="text-base font-semibold text-primary tabular-nums font-mono">184 ms</span>
              </div>
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-sm text-secondary">Mean Retrieval Similarity</span>
                <span className="text-base font-semibold text-accent tabular-nums font-mono">0.864</span>
              </div>
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-sm text-secondary">Context Groundedness Score</span>
                <span className="text-base font-semibold text-primary tabular-nums font-mono">4.9 / 5.0</span>
              </div>
            </div>
          </div>
        </section>

        {/* Closing Call to Action */}
        <section className="border-t border-subtle bg-surface/50">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 py-16 sm:py-20 text-center space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Ready to screen your candidate pool?
            </h2>
            <p className="text-sm text-secondary max-w-md mx-auto">
              Create your own job workspace or load six bundled sample resumes in one click.
            </p>
            <div className="pt-1 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={onLoadSample}
                disabled={loadingSample}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-accent hover:bg-accent-hover text-root text-sm font-semibold transition-colors interactive-button focus-ring"
              >
                <Sparkles className="w-4 h-4" />
                <span>{loadingSample ? "Loading Demo…" : "Try 1-Click Demo"}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate("candidates")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-elevated hover:bg-overlay text-primary border border-subtle text-sm font-semibold transition-colors interactive-button focus-ring"
              >
                <span>Open Screening Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-subtle py-6 px-5 sm:px-8 text-xs text-tertiary">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-secondary font-medium">TalentScan AI · Auditable Candidate Intelligence</span>
          <span className="font-mono">SQLite · ChromaDB · Gemini Flash</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingView;
