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
} from "lucide-react";

const WORKBENCH_SCENARIOS = [
  {
    id: "shortlist",
    label: "Top Shortlist",
    query: "Identify the top 3 candidates and explain why they fit this job description.",
    latency: "142 ms",
    chunks: "12 chunks",
    results: [
      {
        name: "arjun_mehta_fullstack.pdf",
        score: "0.91",
        summary: "4+ years React, TypeScript, and Flask REST APIs. Built ChromaDB RAG search in production.",
      },
      {
        name: "priya_nair_backend.pdf",
        score: "0.87",
        summary: "Strong Python, PostgreSQL, and Docker CI/CD pipelines. Led API latency reduction by 38%.",
      },
      {
        name: "rohan_kapoor_swe.pdf",
        score: "0.82",
        summary: "Full-stack React and FastAPI background with automated Playwright and pytest suites.",
      },
    ],
  },
  {
    id: "matrix",
    label: "Skills Matrix",
    query: "Create a skills comparison matrix for all candidates against the requirements.",
    latency: "168 ms",
    chunks: "16 chunks",
    results: [
      {
        name: "React & TypeScript",
        score: "5 / 6",
        summary: "Verified production experience across Arjun, Rohan, Sneha, Vikram, and Ananya.",
      },
      {
        name: "Python & Flask / FastAPI",
        score: "4 / 6",
        summary: "Priya, Arjun, Rohan, and Kabir list REST API ownership and schema migrations.",
      },
      {
        name: "Vector DBs & RAG",
        score: "3 / 6",
        summary: "Arjun (ChromaDB), Priya (pgvector), and Kabir (LangChain) show direct retrieval work.",
      },
    ],
  },
  {
    id: "infra",
    label: "Docker & CI/CD",
    query: "Which candidate has the most hands-on experience with Docker and CI/CD?",
    latency: "129 ms",
    chunks: "9 chunks",
    results: [
      {
        name: "priya_nair_backend.pdf",
        score: "0.94",
        summary: "Authored multi-stage Dockerfiles, GitHub Actions release workflows, and Cloud Run deploys.",
      },
      {
        name: "kabir_sharma_platform.pdf",
        score: "0.86",
        summary: "Maintained containerized Python microservices and automated staging pipelines on AWS.",
      },
      {
        name: "arjun_mehta_fullstack.pdf",
        score: "0.78",
        summary: "Containerized local dev stacks with Docker Compose and integrated lint/build checks.",
      },
    ],
  },
];

const PIPELINE_PILLARS = [
  {
    icon: Database,
    title: "Vector Ingestion",
    description:
      "Parses multi-page PDF resumes into semantic chunks and indexes them alongside your target job description in ChromaDB.",
  },
  {
    icon: Search,
    title: "Grounded Synthesis",
    description:
      "Generates candidate rankings, skill matrices, and tailored interview questions anchored strictly in retrieved resume text.",
  },
  {
    icon: ShieldCheck,
    title: "Automated Quality Checks",
    description:
      "Scores every screening answer asynchronously for relevance, groundedness, and hallucination risk in SQLite.",
  },
];

const LandingView = ({ status, onNavigate, onOpenCommandPalette }) => {
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
      {/* Borderless Top Navigation Bar */}
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
            className="text-base sm:text-lg font-bold tracking-tight text-primary focus-ring rounded-sm"
          >
            TalentScan AI
          </button>

          <nav aria-label="Homepage Navigation" className="hidden md:flex items-center gap-7 text-sm font-medium">
            <button
              type="button"
              onClick={() => onNavigate("app")}
              className="text-secondary hover:text-primary transition-colors focus-ring rounded-sm"
            >
              Screening
            </button>
            <button
              type="button"
              onClick={() => onNavigate("pool")}
              className="text-secondary hover:text-primary transition-colors focus-ring rounded-sm"
            >
              Candidate Pool
            </button>
            <button
              type="button"
              onClick={() => onNavigate("aiops")}
              className="text-secondary hover:text-primary transition-colors focus-ring rounded-sm"
            >
              Observability
            </button>
            <button
              type="button"
              onClick={() => onNavigate("settings")}
              className="text-secondary hover:text-primary transition-colors focus-ring rounded-sm"
            >
              Settings
            </button>
          </nav>

          <div className="flex items-center gap-3">
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
              onClick={() => onNavigate("app")}
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
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-16 sm:pb-24">
          <div className="max-w-4xl mx-auto text-center space-y-6 hero-enter">
            <h1
              tabIndex={-1}
              className="font-bold text-primary tracking-[-0.035em] leading-[0.98] outline-none"
              style={{ fontSize: "clamp(2.35rem, 1.35rem + 4.2vw, 4.75rem)" }}
            >
              Screen engineering candidates with grounded evidence.
            </h1>

            <p className="text-sm sm:text-base text-secondary leading-relaxed max-w-xl mx-auto">
              Upload PDF resumes and a job description. Run natural-language queries backed by vector retrieval and automated quality checks.
            </p>

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => onNavigate("app")}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-md bg-accent hover:bg-accent-hover text-root text-sm font-semibold transition-colors interactive-button focus-ring"
              >
                <span>Open Screening Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Wide Interactive Screening Stage */}
          <div className="mt-12 sm:mt-16 max-w-5xl mx-auto hero-enter-delay">
            <div className="rounded-lg border border-subtle bg-surface/95 shadow-2xl overflow-hidden">
              {/* Stage Header with Connected Segmented Toggle */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-subtle bg-elevated/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-primary">
                  <FileText className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>Interactive Screening Preview</span>
                </div>

                <div
                  role="tablist"
                  aria-label="Sample screening queries"
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
                            ? "bg-elevated text-primary"
                            : "text-secondary hover:text-primary"
                        }`}
                      >
                        {scenario.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Query Prompt Bar */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-subtle bg-root/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-primary min-w-0">
                  <Search className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="truncate">{activeScenario.query}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-tertiary tabular-nums flex-shrink-0">
                  <span>{activeScenario.chunks}</span>
                  <span className="text-accent font-medium">{activeScenario.latency}</span>
                </div>
              </div>

              {/* Grounded Results List */}
              <div className="divide-y divide-subtle">
                {activeScenario.results.map((item) => (
                  <div
                    key={item.name}
                    className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-6 hover:bg-elevated/35 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="text-sm font-semibold text-primary truncate">
                          {item.name}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-secondary leading-relaxed pl-6">
                        {item.summary}
                      </p>
                    </div>
                    <div className="pl-6 sm:pl-0 flex-shrink-0 text-left sm:text-right">
                      <span className="text-sm font-semibold text-accent tabular-nums">
                        {item.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stage Footer */}
              <div className="px-4 sm:px-6 py-3 border-t border-subtle bg-elevated/30 flex flex-wrap items-center justify-between gap-3 text-xs text-secondary">
                <span>
                  {status.online
                    ? `Backend connected (${status.resumes_count} indexed resumes)`
                    : "Start the FastAPI server to run queries against your own PDFs"}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate("app")}
                  className="inline-flex items-center gap-1.5 text-accent hover:text-accent-hover font-medium transition-colors focus-ring rounded-sm"
                >
                  <span>Try with sample resumes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Asymmetric Editorial Workflow Section */}
        <section className="border-t border-subtle bg-surface/40">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
            <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight leading-tight">
                From raw PDFs to verified shortlists.
              </h2>
              <p className="text-sm text-secondary leading-relaxed max-w-prose">
                Every answer is anchored to retrieved resume chunks in ChromaDB, so hiring teams see exact evidence rather than unverified summaries.
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
                Built-in observability for every screening query.
              </h2>
              <p className="text-sm text-secondary leading-relaxed max-w-prose">
                Track P50 and P95 latency, vector similarity scores, and automated LLM-as-a-judge ratings across every request.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate("aiops")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-elevated hover:bg-overlay text-primary border border-subtle text-sm font-medium transition-colors interactive-button focus-ring"
                >
                  <Activity className="w-4 h-4 text-accent" />
                  <span>Inspect Observability</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-lg border border-subtle bg-surface divide-y divide-subtle">
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-sm text-secondary">Median End-to-End Latency</span>
                <span className="text-base font-semibold text-primary tabular-nums">184 ms</span>
              </div>
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-sm text-secondary">Mean Retrieval Similarity</span>
                <span className="text-base font-semibold text-accent tabular-nums">0.864</span>
              </div>
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-sm text-secondary">Context Groundedness Score</span>
                <span className="text-base font-semibold text-primary tabular-nums">4.9 / 5.0</span>
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
              Upload your own PDFs or load six bundled sample resumes in one click.
            </p>
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={() => onNavigate("app")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-accent hover:bg-accent-hover text-root text-sm font-semibold transition-colors interactive-button focus-ring"
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
          <span className="text-secondary font-medium">TalentScan AI</span>
          <span>ChromaDB · Gemini Flash · SQLite AIOps</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingView;
