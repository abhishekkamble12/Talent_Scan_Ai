import React, { useState } from "react";
import axios from "axios";
import { Plus, X, ArrowLeftRight, Check, Sparkles, AlertCircle } from "lucide-react";
import { BACKEND_URL } from "../api/client";

export const RequirementChips = ({
  jobId,
  requirements = [],
  onRequirementsUpdated,
  onTriggerRescreen,
  isScreening = false,
}) => {
  const [chips, setChips] = useState(requirements);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("must_have");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  // Sync state if props change
  React.useEffect(() => {
    setChips(requirements);
  }, [requirements]);

  const mustHaves = chips.filter((c) => c.category === "must_have");
  const niceToHaves = chips.filter((c) => c.category === "nice_to_have");

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newText.trim()) return;
    const newChip = {
      id: "temp-" + Date.now(),
      text: newText.trim(),
      category: newCategory,
      sort_order: chips.length,
    };
    setChips((prev) => [...prev, newChip]);
    setNewText("");
  };

  const handleRemove = (id) => {
    setChips((prev) => prev.filter((c) => c.id !== id));
  };

  const handleToggleCategory = (id) => {
    setChips((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            category: c.category === "must_have" ? "nice_to_have" : "must_have",
          };
        }
        return c;
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaveSuccess(false);
    try {
      const payload = {
        requirements: chips.map((c, i) => ({
          id: c.id?.startsWith("temp-") ? null : c.id,
          text: c.text,
          category: c.category,
          sort_order: i,
        })),
      };
      const res = await axios.patch(`${BACKEND_URL}/api/jobs/${jobId}/requirements`, payload);
      setChips(res.data.requirements);
      onRequirementsUpdated?.(res.data.requirements);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update requirements.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-surface border border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-primary">Role Evaluation Criteria</h3>
          <p className="text-xs text-secondary mt-0.5">
            Recruiter controls: Edit, add, or toggle requirement priorities. Candidates are scored directly against these chips.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Saved</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-root font-semibold text-xs transition interactive-button focus-ring"
          >
            {saving ? "Saving…" : "Save Criteria"}
          </button>
          {onTriggerRescreen && (
            <button
              type="button"
              onClick={onTriggerRescreen}
              disabled={isScreening}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent-tint hover:bg-accent-tint/80 border border-accent-border text-accent text-xs font-semibold transition interactive-button focus-ring"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isScreening ? "Screening…" : "Re-screen Candidates"}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Must-Haves Section */}
      <div className="p-5 rounded-lg bg-surface border border-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider font-mono">
              Must-Haves ({mustHaves.length})
            </h4>
          </div>
          <span className="text-micro text-tertiary">75% weight in fit score</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {mustHaves.map((chip) => (
            <div
              key={chip.id}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-elevated border border-emerald-500/30 text-primary text-xs hover:border-emerald-500/60 transition"
            >
              <span className="text-emerald-400 font-bold">✓</span>
              <span className="leading-tight">{chip.text}</span>
              <button
                type="button"
                onClick={() => handleToggleCategory(chip.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-tertiary hover:text-amber-400 transition ml-1"
                title="Move to Nice-to-Have"
              >
                <ArrowLeftRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(chip.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-tertiary hover:text-rose-400 transition"
                title="Remove requirement"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {mustHaves.length === 0 && (
            <span className="text-xs text-tertiary italic">No must-have requirements added.</span>
          )}
        </div>
      </div>

      {/* Nice-To-Haves Section */}
      <div className="p-5 rounded-lg bg-surface border border-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider font-mono">
              Nice-to-Haves ({niceToHaves.length})
            </h4>
          </div>
          <span className="text-micro text-tertiary">25% bonus weight</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {niceToHaves.map((chip) => (
            <div
              key={chip.id}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-elevated border border-amber-500/30 text-primary text-xs hover:border-amber-500/60 transition"
            >
              <span className="text-amber-400 font-bold">◐</span>
              <span className="leading-tight">{chip.text}</span>
              <button
                type="button"
                onClick={() => handleToggleCategory(chip.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-tertiary hover:text-emerald-400 transition ml-1"
                title="Move to Must-Have"
              >
                <ArrowLeftRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(chip.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-tertiary hover:text-rose-400 transition"
                title="Remove requirement"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {niceToHaves.length === 0 && (
            <span className="text-xs text-tertiary italic">No nice-to-have requirements added.</span>
          )}
        </div>
      </div>

      {/* Add New Requirement Bar */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add requirement (e.g. 3+ years AWS or GCP architecture)…"
          className="flex-1 px-3 py-2 bg-root border border-subtle rounded-md text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="px-3 py-2 bg-elevated border border-subtle rounded-md text-xs text-primary focus-visible:outline-none focus-visible:border-accent"
        >
          <option value="must_have">Must-Have</option>
          <option value="nice_to_have">Nice-to-Have</option>
        </select>
        <button
          type="submit"
          disabled={!newText.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-elevated hover:bg-overlay border border-subtle text-primary font-medium text-xs transition focus-ring disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Chip</span>
        </button>
      </form>
    </div>
  );
};

export default RequirementChips;
