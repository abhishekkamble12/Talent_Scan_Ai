import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Users,
  Activity,
  Settings,
  Sparkles,
  RefreshCw,
  Layout,
  CornerDownLeft,
  X,
} from "lucide-react";

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

const CommandPalette = ({ isOpen, onClose, onNavigate, onLoadSample, onRefreshStatus }) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);

  const commands = [
    {
      id: "nav-app",
      label: "Go to Candidate Screening",
      category: "Navigation",
      icon: Sparkles,
      action: () => onNavigate("app"),
    },
    {
      id: "nav-pool",
      label: "Go to Candidate Pool",
      category: "Navigation",
      icon: Users,
      action: () => onNavigate("pool"),
    },
    {
      id: "nav-aiops",
      label: "Go to AI Performance & Ops",
      category: "Navigation",
      icon: Activity,
      action: () => onNavigate("aiops"),
    },
    {
      id: "nav-settings",
      label: "Go to Workspace Settings",
      category: "Navigation",
      icon: Settings,
      action: () => onNavigate("settings"),
    },
    {
      id: "nav-landing",
      label: "View Product Overview",
      category: "Navigation",
      icon: Layout,
      action: () => onNavigate("landing"),
    },
    {
      id: "act-sample",
      label: "Load Sample Candidates & JD",
      category: "Actions",
      icon: Sparkles,
      action: () => onLoadSample(),
    },
    {
      id: "act-sync",
      label: "Refresh System Telemetry",
      category: "Actions",
      icon: RefreshCw,
      action: () => onRefreshStatus(),
    },
  ];

  const filtered = commands.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  const closeTopLayer = useCallback(async () => {
    const dialog = dialogRef.current;
    if (!dialog || !dialog.open) return;

    if (!supportsTopLayerExit()) {
      dialog.setAttribute("data-closing", "");
      const animations = dialog.getAnimations({ subtree: true });
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map((a) => a.finished)),
          new Promise((r) => setTimeout(r, 400)),
        ]);
      }
      if (!dialog.hasAttribute("data-closing")) return;
      dialog.removeAttribute("data-closing");
    }

    dialog.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      setQuery("");
      setSelectedIndex(0);
      dialog.removeAttribute("data-closing");
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!isOpen && dialog.open) {
      closeTopLayer();
    }
  }, [isOpen, closeTopLayer]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.removeAttribute("data-closing");
      onClose();
    };

    const handleCancel = (e) => {
      e.preventDefault();
      closeTopLayer();
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);

    // Fallback for browsers without closedby="any" support
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
          closeTopLayer();
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
  }, [onClose, closeTopLayer]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      closeTopLayer();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      {...{ closedby: "any" }}
      aria-label="Command Palette"
      className="command-dialog w-full max-w-lg mt-[15vh] mx-auto p-0 bg-surface border border-muted rounded-lg overflow-hidden text-primary"
    >
      {/* Search Input */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-subtle bg-elevated/50">
        <Search className="w-4 h-4 text-tertiary flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command or jump to a view…"
          className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
        />
        <kbd className="text-[11px] font-mono text-tertiary px-1.5 py-0.5 rounded bg-root border border-subtle">
          ESC
        </kbd>
        <button
          type="button"
          onClick={closeTopLayer}
          aria-label="Close command palette"
          className="p-1 rounded text-tertiary hover:text-primary hover:bg-elevated transition-colors focus-ring"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Results */}
      <div className="max-h-72 overflow-y-auto p-2 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-tertiary">No matching commands found.</div>
        ) : (
          filtered.map((cmd, idx) => {
            const Icon = cmd.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={cmd.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  cmd.action();
                  closeTopLayer();
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-left text-xs transition-colors ${
                  isSelected
                    ? "bg-accent-tint text-primary border border-accent-border"
                    : "text-secondary hover:bg-elevated border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-accent" : "text-tertiary"}`} />
                  <span className="font-medium truncate">{cmd.label}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] font-mono text-tertiary">{cmd.category}</span>
                  {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-accent" />}
                </div>
              </button>
            );
          })
        )}
      </div>
    </dialog>
  );
};

export default CommandPalette;
