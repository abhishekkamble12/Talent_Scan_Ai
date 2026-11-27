import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import ResumeUploader from "./ResumeUploader";
import LLMQueryComponent from "./LLMQueryComponent";
import AIOpsDashboard from "./AIOpsDashboard";
import CandidatePool from "./components/CandidatePool";
import WorkspaceSettings from "./components/WorkspaceSettings";
import CommandPalette from "./components/CommandPalette";
import LandingView from "./components/LandingView";
import { Badge } from "./components/ui";
import {
  Database,
  RefreshCw,
  Sparkles,
  Activity,
  X,
  Sliders,
  AlertCircle,
  Menu,
  ChevronRight,
  Users,
  FileText,
  Settings,
  Layout,
  Command,
  CheckCircle2,
  Circle,
} from "lucide-react";

import { BACKEND_URL } from "./api/client";

let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.("transition-behavior", "allow-discrete") || !document.body) {
    return false;
  }
  const probe = document.createElement("div");
  probe.style.cssText = "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = "none";
  supportsDisplayTransition = getComputedStyle(probe).display === "block";
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit() {
  return window.CSS?.supports?.("overlay", "auto") && canTransitionDisplay();
}

const NAV_ITEMS = [
  {
    group: "Workspace",
    items: [
      {
        id: "app",
        label: "Candidate Screening",
        icon: Sparkles,
      },
      {
        id: "pool",
        label: "Candidate Pool",
        icon: Users,
      },
    ],
  },
  {
    group: "Observability",
    items: [
      {
        id: "aiops",
        label: "AI Performance & Ops",
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
      {
        id: "landing",
        label: "Homepage",
        icon: Layout,
      },
    ],
  },
];

const App = () => {
  const [status, setStatus] = useState({
    online: false,
    resumes_count: 0,
    resumes: [],
    has_job_description: false,
    job_description_full: "",
    api_key_configured: false,
  });
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [activeTab, setActiveTab] = useState("landing"); // "landing" | "app" | "pool" | "aiops" | "settings"
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [externalPrompt, setExternalPrompt] = useState("");
  const [hasScreened, setHasScreened] = useState(() => {
    return localStorage.getItem("talentscan_has_screened") === "true";
  });
  const [showChecklist, setShowChecklist] = useState(() => {
    return localStorage.getItem("talentscan_dismiss_checklist") !== "true";
  });

  const dismissChecklist = () => {
    setShowChecklist(false);
    localStorage.setItem("talentscan_dismiss_checklist", "true");
  };

  const handleQuerySuccess = () => {
    setHasScreened(true);
    localStorage.setItem("talentscan_has_screened", "true");
  };

  const fetchStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/status`, { timeout: 3000 });
      setStatus({
        online: true,
        resumes_count: res.data.resumes_count || 0,
        resumes: res.data.resumes || [],
        has_job_description: res.data.has_job_description || false,
        job_description_full: res.data.job_description_full || "",
        api_key_configured: res.data.api_key_configured || false,
      });
    } catch {
      setStatus((prev) => ({
        ...prev,
        online: false,
      }));
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleLoadSampleFromShell = async () => {
    setLoadingSample(true);
    try {
      await axios.post(`${BACKEND_URL}/api/load-sample`);
      await fetchStatus();
    } catch {
      // Handled by offline/status indicators
    } finally {
      setLoadingSample(false);
    }
  };

  const handleScreenCandidate = (filename, candidateName) => {
    const label = candidateName ? `${candidateName} (${filename})` : filename;
    setExternalPrompt(
      `Summarize the strengths, relevant experience, and overall fit of ${label} for this job description.`
    );
    setActiveTab("app");
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const activeNav = NAV_ITEMS.flatMap((g) => g.items).find((i) => i.id === activeTab);
  const drawerRef = useRef(null);

  const closeMobileDrawer = useCallback(async () => {
    const dialog = drawerRef.current;
    if (!dialog || !dialog.open) {
      setMobileNavOpen(false);
      return;
    }

    if (!supportsTopLayerExit()) {
      dialog.setAttribute("data-closing", "");
      const animations = dialog.getAnimations({ subtree: true });
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map((a) => a.finished)),
          new Promise((r) => setTimeout(r, 350)),
        ]);
      }
      if (!dialog.hasAttribute("data-closing")) return;
      dialog.removeAttribute("data-closing");
    }

    dialog.close();
    setMobileNavOpen(false);
  }, []);

  const openMobileDrawer = useCallback(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    setMobileNavOpen(true);
    if (!dialog.open) {
      dialog.removeAttribute("data-closing");
      dialog.showModal();
    }
  }, []);

  const handleSelectTab = (id) => {
    closeMobileDrawer();
    if (activeTab === id) return;

    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActiveTab(id);
      return;
    }

    const transition = document.startViewTransition(() => {
      setActiveTab(id);
    });

    transition.finished.finally(() => {
      const heading = document.querySelector("#main-content h1, #main-content [tabindex='-1']");
      heading?.focus?.();
    });
  };

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.removeAttribute("data-closing");
      setMobileNavOpen(false);
    };

    const handleCancel = (e) => {
      e.preventDefault();
      closeMobileDrawer();
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);

    let cleanupPointer = null;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const onPointerDown = (e) => {
        pressedOutside = outside(e);
      };
      const onPointerUp = (e) => {
        if (pressedOutside && outside(e)) {
          closeMobileDrawer();
        }
      };
      dialog.addEventListener("pointerdown", onPointerDown);
      dialog.addEventListener("pointerup", onPointerUp);
      cleanupPointer = () => {
        dialog.removeEventListener("pointerdown", onPointerDown);
        dialog.removeEventListener("pointerup", onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
      cleanupPointer?.();
    };
  }, [closeMobileDrawer]);

  const checklistSteps = [
    {
      label: "Connect Gemini API",
      done: status.api_key_configured,
    },
    {
      label: "Index Resumes & Role",
      done: status.has_job_description && status.resumes_count > 0,
    },
    {
      label: "Run AI Screening",
      done: hasScreened,
    },
  ];
  const completedCount = checklistSteps.filter((s) => s.done).length;

  const SidebarContent = ({ isDrawer = false }) => (
    <div className="flex flex-col h-full bg-surface border-r border-subtle">
      {/* Brand Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-subtle flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-accent-tint border border-accent-border flex items-center justify-center text-accent flex-shrink-0">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-primary truncate">TalentScan AI</div>
            <div className="text-[11px] font-mono text-tertiary truncate">Recruiting Suite</div>
          </div>
        </div>
        {isDrawer && (
          <button
            onClick={closeMobileDrawer}
            className="p-1 rounded text-tertiary hover:text-primary hover:bg-elevated focus-ring"
            aria-label="Close navigation menu"
            autoFocus
          >
            <X className="w-4 h-4" />
          </button>
        )}
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
                    id={`nav-${item.id}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors focus-ring ${
                      isActive
                        ? "bg-elevated text-primary border border-subtle"
                        : "text-secondary hover:text-primary hover:bg-elevated/50 border border-transparent"
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-accent" : "text-tertiary"}`} />
                    <span className="text-xs font-medium truncate flex-1">{item.label}</span>
                    {item.id === "pool" && status.resumes_count > 0 && (
                      <span className="text-[11px] font-mono text-tertiary tabular-nums">
                        {status.resumes_count}
                      </span>
                    )}
                    {item.id === "aiops" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" title="Live Telemetry" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System Health & Telemetry Card */}
      <div className="p-3 border-t border-subtle bg-root/40 flex-shrink-0">
        <div className="p-3 rounded-md bg-elevated/60 border border-subtle space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-tertiary">System Status</span>
            <button
              onClick={fetchStatus}
              disabled={checkingStatus}
              className="p-1 rounded text-tertiary hover:text-primary hover:bg-overlay transition focus-ring"
              title="Sync system status"
              aria-label="Sync system status"
            >
              <RefreshCw className={`w-3 h-3 ${checkingStatus ? "animate-spin text-accent" : ""}`} />
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-secondary">Backend API</span>
              <Badge variant={status.online ? "success" : "error"} dot>
                {status.online ? "Online" : "Offline"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Indexed Pool</span>
              <span className="font-mono text-xs text-primary tabular-nums">
                {status.resumes_count} {status.resumes_count === 1 ? "resume" : "resumes"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Gemini Auth</span>
              <span
                className={`font-mono text-[11px] ${
                  status.api_key_configured ? "text-accent" : "text-status-warning"
                }`}
              >
                {status.api_key_configured ? "Configured" : "Key Needed"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (activeTab === "landing") {
    return (
      <>
        <CommandPalette
          isOpen={commandOpen}
          onClose={() => setCommandOpen(false)}
          onNavigate={handleSelectTab}
          onLoadSample={handleLoadSampleFromShell}
          onRefreshStatus={fetchStatus}
        />
        <LandingView
          status={status}
          onNavigate={handleSelectTab}
          onOpenCommandPalette={() => setCommandOpen(true)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-root text-primary flex font-sans selection:bg-accent-tint selection:text-accent">
      {/* Command Palette */}
      <CommandPalette
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNavigate={handleSelectTab}
        onLoadSample={handleLoadSampleFromShell}
        onRefreshStatus={fetchStatus}
      />

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-0 h-screen z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Slide-over Drawer Dialog */}
      <dialog
        id="mobile-drawer"
        ref={drawerRef}
        {...{ closedby: "any" }}
        aria-label="Navigation drawer"
        className="drawer-dialog lg:hidden"
      >
        <div className="w-64 max-w-[80vw] h-full shadow-2xl">
          <SidebarContent isDrawer />
        </div>
      </dialog>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Context Bar */}
        <header className="h-14 border-b border-subtle bg-surface/90 backdrop-blur-sm sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="mobile-drawer-open"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-drawer"
              onClick={openMobileDrawer}
              className="lg:hidden p-1.5 rounded-md text-secondary hover:text-primary hover:bg-elevated border border-subtle focus-ring"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
              <span className="text-tertiary hidden sm:inline">Workspace</span>
              <ChevronRight className="w-3.5 h-3.5 text-tertiary hidden sm:inline flex-shrink-0" />
              <span className="font-semibold text-primary truncate">{activeNav?.label}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded bg-elevated hover:bg-overlay border border-subtle text-micro text-secondary hover:text-primary transition focus-ring"
              title="Open Command Palette (Ctrl+K)"
            >
              <Command className="w-3 h-3 text-tertiary" />
              <span>Quick Jump</span>
              <kbd className="font-mono text-[10px] text-tertiary bg-root px-1 rounded border border-subtle">
                Ctrl+K
              </kbd>
            </button>

            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-elevated border border-subtle text-micro font-mono text-secondary">
              <Database className="w-3 h-3 text-accent" />
              <span className="tabular-nums text-primary font-medium">{status.resumes_count}</span>
              <span>Candidates</span>
            </div>
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-elevated border border-subtle text-micro font-mono text-secondary">
              <FileText className={`w-3 h-3 ${status.has_job_description ? "text-accent" : "text-tertiary"}`} />
              <span>{status.has_job_description ? "Role Criteria Set" : "No Role Criteria"}</span>
            </div>
            <Badge variant={status.online ? "success" : "error"} dot className="lg:hidden">
              {status.online ? "Online" : "Offline"}
            </Badge>
          </div>
        </header>

        {/* Activation Checklist Banner */}
        {showChecklist && activeTab === "app" && (
          <div className="border-b border-subtle bg-surface/60 text-xs text-secondary">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                <span className="text-micro font-mono uppercase tracking-wider text-accent">
                  Setup ({completedCount}/3)
                </span>
                {checklistSteps.map((step, i) => (
                  <div key={i} className="inline-flex items-center gap-1.5">
                    {step.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-tertiary flex-shrink-0" />
                    )}
                    <span className={step.done ? "text-primary font-medium" : "text-secondary"}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={dismissChecklist}
                className="text-tertiary hover:text-primary p-1 rounded focus-ring flex-shrink-0"
                title="Dismiss checklist"
                aria-label="Dismiss checklist"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Offline Diagnostic Banner */}
        {!status.online && (
          <div className="border-b border-status-error-border bg-status-error-bg text-status-error text-xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Backend service is unreachable. Start the API server with{" "}
                  <code className="font-mono text-primary bg-elevated px-1.5 py-0.5 rounded border border-subtle">
                    python backend/app.py
                  </code>{" "}
                  or{" "}
                  <code className="font-mono text-primary bg-elevated px-1.5 py-0.5 rounded border border-subtle">
                    .\start_project.bat
                  </code>
                </span>
              </div>
              <button
                onClick={fetchStatus}
                className="px-3 py-1 rounded bg-status-error text-root font-semibold text-xs hover:opacity-90 transition focus-ring"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Main View Area */}
        <main id="main-content" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 main-view-transition">
          {activeTab === "app" && (
            <section
              id="view-app"
              aria-labelledby="heading-app"
              className="space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h1 id="heading-app" tabIndex={-1} className="text-xl font-semibold text-primary tracking-tight outline-none">
                    Candidate Screening
                  </h1>
                  <p className="text-xs text-secondary mt-0.5">
                    Index candidate resumes against your job description and run AI-assisted evaluations.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5">
                  <ResumeUploader onDataUpdated={fetchStatus} currentStatus={status} />
                </div>
                <div className="lg:col-span-7">
                  <LLMQueryComponent
                    currentStatus={status}
                    externalPrompt={externalPrompt}
                    onExternalPromptHandled={() => setExternalPrompt("")}
                    onQuerySuccess={handleQuerySuccess}
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === "pool" && (
            <section id="view-pool" aria-label="Candidate Pool">
              <CandidatePool
                resumes={status.resumes}
                hasJobDescription={status.has_job_description}
                onScreenCandidate={handleScreenCandidate}
                onNavigateToScreening={() => handleSelectTab("app")}
                onLoadSample={handleLoadSampleFromShell}
                loadingSample={loadingSample}
                onDataUpdated={fetchStatus}
              />
            </section>
          )}

          {activeTab === "aiops" && (
            <section id="view-aiops" aria-label="AI Performance & Observability">
              <AIOpsDashboard />
            </section>
          )}

          {activeTab === "settings" && (
            <section id="view-settings" aria-label="Workspace Settings">
              <WorkspaceSettings status={status} onRefreshStatus={fetchStatus} />
            </section>
          )}
        </main>

        {/* Minimal SaaS Footer */}
        <footer className="border-t border-subtle bg-surface/50 py-3.5 px-4 sm:px-6 lg:px-8 text-micro text-tertiary">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>TalentScan AI · RAG Candidate Intelligence</span>
            <span className="font-mono">ChromaDB Vector Store · Gemini Flash</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
