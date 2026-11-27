import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import AIOpsDashboard from "./AIOpsDashboard";
import WorkspaceSettings from "./components/WorkspaceSettings";
import CommandPalette from "./components/CommandPalette";
import LandingView from "./components/LandingView";
import CandidatesView from "./views/CandidatesView";
import JobSetup from "./views/JobSetup";
import { SharedScorecardView } from "./views/SharedScorecardView";
import { CandidateSelfCheckView } from "./views/CandidateSelfCheckView";
import { Badge } from "./components/ui";
import {
  Sparkles,
  Activity,
  X,
  Sliders,
  AlertCircle,
  Menu,
  ChevronRight,
  ChevronDown,
  Briefcase,
  Users,
  Settings,
  Plus,
  RefreshCw,
  Trash2,
  Home,
  Sun,
  Moon,
} from "lucide-react";

import { BACKEND_URL } from "./api/client";

const NAV_ITEMS = [
  {
    group: "Workspace",
    items: [
      {
        id: "home",
        label: "Home",
        icon: Home,
      },
      {
        id: "candidates",
        label: "Candidate Screening",
        icon: Users,
      },
      {
        id: "jobs",
        label: "Job Openings",
        icon: Briefcase,
      },
      {
        id: "self-check",
        label: "Candidate Self-Check",
        icon: Sparkles,
      },
    ],
  },
  {
    group: "Observability",
    items: [
      {
        id: "aiops",
        label: "Insights & Performance",
        icon: Activity,
      },
    ],
  },
  {
    group: "System",
    items: [
      {
        id: "settings",
        label: "Workspace Settings",
        icon: Settings,
      },
    ],
  },
];

const App = () => {
  const [status, setStatus] = useState({
    online: false,
    resumes_count: 0,
    api_key_configured: false,
    jobs_count: 0,
  });
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [activeTab, setActiveTab] = useState("home"); // "home" | "candidates" | "jobs" | "job-create" | "self-check" | "aiops" | "settings"
  const [shareToken, setShareToken] = useState(() => {
    return new URLSearchParams(window.location.search).get("share");
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("talentscan_theme") || "dark";
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("talentscan_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  // Job management state
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/jobs`);
      const fetchedJobs = res.data.jobs || [];
      setJobs(fetchedJobs);

      // If no active job or active job deleted, select the first
      setActiveJobId((current) => {
        if (current && fetchedJobs.some((j) => j.id === current)) {
          return current;
        }
        return fetchedJobs.length > 0 ? fetchedJobs[0].id : null;
      });
    } catch (err) {
      console.warn("Failed fetching jobs list:", err);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/status`, { timeout: 3000 });
      setStatus({
        online: true,
        resumes_count: res.data.resumes_count || 0,
        api_key_configured: res.data.api_key_configured || false,
        jobs_count: res.data.jobs_count || 0,
      });
      await fetchJobs();
    } catch {
      setStatus((prev) => ({
        ...prev,
        online: false,
      }));
    } finally {
      setCheckingStatus(false);
    }
  }, [fetchJobs]);

  const handleLoadSampleDemo = async () => {
    setLoadingSample(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/load-sample`);
      if (res.data.job) {
        setActiveJobId(res.data.job.id);
      }
      await fetchStatus();
      setActiveTab("candidates");
    } catch (err) {
      console.error("Failed loading sample demo:", err);
    } finally {
      setLoadingSample(false);
    }
  };

  const handleDeleteJob = async (jobId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this job workspace? All associated candidate scores will be removed.")) {
      return;
    }
    try {
      await axios.delete(`${BACKEND_URL}/api/jobs/${jobId}`);
      await fetchJobs();
    } catch (err) {
      console.error("Delete job error:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 20000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setMobileNavOpen(false);
        setJobDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Close job dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setJobDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeJob = jobs.find((j) => j.id === activeJobId) || jobs[0] || null;
  const activeNav = NAV_ITEMS.flatMap((g) => g.items).find((i) => i.id === activeTab);

  if (shareToken) {
    return (
      <SharedScorecardView
        token={shareToken}
        onBackToApp={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("share");
          window.history.replaceState({}, "", url.pathname);
          setShareToken(null);
        }}
      />
    );
  }

  if (activeTab === "home") {
    return (
      <>
        <CommandPalette
          isOpen={commandOpen}
          onClose={() => setCommandOpen(false)}
          onNavigate={(tab) => {
            if (tab === "app" || tab === "pool") setActiveTab("candidates");
            else if (tab === "landing") setActiveTab("home");
            else setActiveTab(tab);
          }}
          onLoadSample={handleLoadSampleDemo}
          onRefreshStatus={fetchStatus}
        />
        <LandingView
          status={status}
          onNavigate={(tab) => setActiveTab(tab === "app" ? "candidates" : tab)}
          onOpenCommandPalette={() => setCommandOpen(true)}
          onLoadSample={handleLoadSampleDemo}
          loadingSample={loadingSample}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-surface border-r border-subtle">
      {/* Brand Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-subtle flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-accent-tint border border-accent-border flex items-center justify-center text-accent flex-shrink-0">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-primary truncate">TalentScan AI</div>
            <div className="text-[11px] font-mono text-tertiary truncate">Auditable Screening</div>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav aria-label="Primary Navigation" className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_ITEMS.map((group) => (
          <div key={group.group} className="space-y-1">
            <div className="px-2.5 pb-1 text-[11px] font-mono uppercase tracking-wider text-tertiary">
              {group.group}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors focus-ring ${
                      isActive
                        ? "bg-elevated text-primary border border-subtle font-medium"
                        : "text-secondary hover:text-primary hover:bg-elevated/50 border border-transparent"
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-accent" : "text-tertiary"}`} />
                    <span className="text-xs font-medium truncate flex-1">{item.label}</span>
                    {item.id === "jobs" && jobs.length > 0 && (
                      <span className="text-[11px] font-mono text-tertiary tabular-nums">
                        {jobs.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 1-Click Demo Shortcut */}
      <div className="p-3 border-t border-subtle bg-root/40 flex-shrink-0">
        <button
          type="button"
          onClick={handleLoadSampleDemo}
          disabled={loadingSample}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-accent-tint hover:bg-accent-tint/80 border border-accent-border text-accent text-xs font-semibold transition interactive-button focus-ring"
        >
          <Sparkles className={`w-3.5 h-3.5 ${loadingSample ? "animate-spin" : ""}`} />
          <span>{loadingSample ? "Loading Demo…" : "1-Click Demo Seed"}</span>
        </button>
      </div>

      {/* System Status Card */}
      <div className="p-3 border-t border-subtle bg-root/40 flex-shrink-0 text-xs">
        <div className="flex items-center justify-between text-secondary">
          <span>Backend API</span>
          <Badge variant={status.online ? "success" : "error"} dot>
            {status.online ? "Online" : "Offline"}
          </Badge>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-root text-primary flex font-sans selection:bg-accent-tint selection:text-accent">
      {/* Command Palette */}
      <CommandPalette
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNavigate={(tab) => {
          if (tab === "app" || tab === "pool") setActiveTab("candidates");
          else setActiveTab(tab);
        }}
        onLoadSample={handleLoadSampleDemo}
        onRefreshStatus={fetchStatus}
      />

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-0 h-screen z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar with Role Switcher */}
        <header className="h-14 border-b border-subtle bg-surface/90 backdrop-blur-sm sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-secondary hover:text-primary hover:bg-elevated border border-subtle focus-ring"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Active Job Switcher Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setJobDropdownOpen((p) => !p)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-elevated hover:bg-overlay border border-subtle text-xs font-semibold text-primary transition focus-ring"
              >
                <Briefcase className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-xs">
                  {activeJob ? activeJob.title : "Select or Create Job"}
                </span>
                <ChevronDown className="w-3 h-3 text-tertiary flex-shrink-0" />
              </button>

              {/* Dropdown Menu */}
              {jobDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-72 rounded-lg bg-surface border border-subtle shadow-2xl z-50 py-1 divide-y divide-subtle animate-in fade-in-50 zoom-in-95">
                  <div className="max-h-60 overflow-y-auto py-1">
                    {jobs.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => {
                          setActiveJobId(j.id);
                          setJobDropdownOpen(false);
                          setActiveTab("candidates");
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-elevated transition text-xs ${
                          j.id === activeJobId ? "bg-accent-tint/30 text-accent font-semibold" : "text-primary"
                        }`}
                      >
                        <span className="truncate">{j.title}</span>
                        <span className="text-micro font-mono text-tertiary flex-shrink-0">
                          {j.candidates_count} cand
                        </span>
                      </button>
                    ))}
                    {jobs.length === 0 && (
                      <div className="p-3 text-center text-xs text-tertiary italic">
                        No active jobs created
                      </div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setJobDropdownOpen(false);
                        setActiveTab("job-create");
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-root font-semibold text-xs transition interactive-button"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Create New Job</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="p-1.5 rounded-md bg-elevated hover:bg-overlay border border-subtle text-secondary hover:text-primary transition focus-ring"
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded bg-elevated hover:bg-overlay border border-subtle text-micro text-secondary hover:text-primary transition focus-ring"
            >
              <span>Quick Jump</span>
              <kbd className="font-mono text-[10px] text-tertiary bg-root px-1 rounded border border-subtle">
                Ctrl+K
              </kbd>
            </button>
          </div>
        </header>

        {/* Offline Diagnostic Banner */}
        {!status.online && (
          <div className="border-b border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Backend API is currently offline. Ensure `python backend/app.py` is running on port 5000.</span>
            </div>
            <button
              onClick={fetchStatus}
              className="px-2.5 py-1 rounded bg-rose-500 text-root font-semibold text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === "candidates" && (
            <CandidatesView
              job={activeJob}
              onJobUpdated={(updated) => {
                setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
              }}
              onOpenCreateJob={() => setActiveTab("job-create")}
              onTriggerDemoSeed={handleLoadSampleDemo}
            />
          )}

          {activeTab === "job-create" && (
            <JobSetup
              onJobCreated={(newJob) => {
                setJobs((prev) => [newJob, ...prev]);
                setActiveJobId(newJob.id);
                setActiveTab("candidates");
              }}
              onCancel={() => setActiveTab("candidates")}
            />
          )}

          {activeTab === "self-check" && (
            <CandidateSelfCheckView
              onBackToHome={() => setActiveTab("home")}
              initialJobId={activeJobId}
            />
          )}

          {activeTab === "jobs" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-primary tracking-tight">Job Openings</h1>
                  <p className="text-xs text-secondary mt-0.5">
                    Manage role workspaces, requirement criteria, and candidate applicant pools.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("job-create")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent hover:bg-accent-hover text-root font-semibold text-xs transition interactive-button focus-ring"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Job</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobs.map((j) => (
                  <div
                    key={j.id}
                    onClick={() => {
                      setActiveJobId(j.id);
                      setActiveTab("candidates");
                    }}
                    className={`p-5 rounded-lg bg-surface border transition cursor-pointer hover:border-accent/60 shadow-xs space-y-3 ${
                      j.id === activeJobId ? "border-accent ring-1 ring-accent" : "border-subtle"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-primary truncate">{j.title}</h3>
                        <p className="text-micro text-tertiary font-mono mt-0.5">
                          Created {new Date(j.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteJob(j.id, e)}
                        className="p-1 rounded text-tertiary hover:text-rose-400 transition"
                        title="Delete Job"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-secondary line-clamp-2 leading-relaxed">
                      {j.description}
                    </p>

                    <div className="pt-2 border-t border-subtle flex items-center justify-between text-xs">
                      <span className="font-mono text-tertiary">
                        {j.requirements?.length || 0} criteria chips
                      </span>
                      <Badge variant="accent">
                        {j.candidates_count || 0} candidates
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "aiops" && (
            <section aria-label="AIOps Performance and Telemetry">
              <div className="mb-4">
                <h1 className="text-xl font-bold text-primary tracking-tight">Engineering Insights &amp; Performance</h1>
                <p className="text-xs text-secondary mt-0.5">
                  Real-time telemetry, RAG latencies, similarity distributions, token costs, and automated LLM evaluators.
                </p>
              </div>
              <AIOpsDashboard />
            </section>
          )}

          {activeTab === "settings" && (
            <WorkspaceSettings status={status} onRefreshStatus={fetchStatus} />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-subtle bg-surface/50 py-3 px-4 sm:px-6 lg:px-8 text-micro text-tertiary mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>TalentScan AI · Job-Centric RAG Candidate Workspace</span>
            <span className="font-mono">SQLite Persistence · Gemini 3.8 Flash · ChromaDB</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
