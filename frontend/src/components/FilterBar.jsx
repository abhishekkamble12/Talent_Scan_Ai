import React from "react";
import { Search, Filter, Download, LayoutGrid, List, EyeOff, SlidersHorizontal, Sparkles } from "lucide-react";

export const FilterBar = ({
  search = "",
  onSearchChange,
  status = "all",
  onStatusChange,
  minScore = 0,
  onMinScoreChange,
  sortMode = "fit_score",
  onSortModeChange,
  modelTrained = false,
  viewMode = "table",
  onViewModeChange,
  blindMode = false,
  onToggleBlindMode,
  onExportCsv,
  totalCount = 0,
  filteredCount = 0,
}) => {
  return (
    <div className="p-3 rounded-lg bg-surface border border-subtle flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-3.5 h-3.5 text-tertiary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search candidates by name, skill, gap, degree…"
          aria-label="Filter candidates"
          className="w-full pl-8 pr-3 py-1.5 bg-root border border-subtle rounded-md text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent"
        />
      </div>

      {/* Filter Dropdowns and Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status Dropdown */}
        <div className="flex items-center gap-1.5 bg-root px-2.5 py-1 rounded-md border border-subtle text-xs">
          <Filter className="w-3 h-3 text-tertiary" />
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="bg-transparent text-primary text-xs focus:outline-none cursor-pointer"
            aria-label="Filter by candidate status"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="maybe">Maybe</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Min Score Filter */}
        <div className="flex items-center gap-1.5 bg-root px-2.5 py-1 rounded-md border border-subtle text-xs">
          <SlidersHorizontal className="w-3 h-3 text-tertiary" />
          <span className="text-tertiary text-micro">Score ≥</span>
          <select
            value={minScore}
            onChange={(e) => onMinScoreChange(Number(e.target.value))}
            className="bg-transparent text-primary text-xs focus:outline-none cursor-pointer tabular-nums"
            aria-label="Filter by minimum score"
          >
            <option value={0}>0%</option>
            <option value={50}>50%</option>
            <option value={70}>70%</option>
            <option value={80}>80%</option>
            <option value={90}>90%</option>
          </select>
        </div>

        {/* Sort: Fit Score vs Smart Rerank (Learned from feedback) */}
        <div className="flex items-center p-0.5 rounded-md bg-root border border-subtle text-xs">
          <button
            type="button"
            onClick={() => onSortModeChange?.("fit_score")}
            className={`px-2 py-0.5 rounded transition ${
              sortMode === "fit_score"
                ? "bg-elevated text-primary font-medium shadow-xs"
                : "text-tertiary hover:text-primary"
            }`}
            title="Sort by baseline JD requirements fit score"
          >
            Fit Score
          </button>
          <button
            type="button"
            onClick={() => onSortModeChange?.("smart_rerank")}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded transition ${
              sortMode === "smart_rerank"
                ? "bg-accent-tint text-accent font-medium border border-accent-border/50 shadow-xs"
                : "text-tertiary hover:text-primary"
            }`}
            title="Sort by feedback-weighted AI reranker based on recruiter shortlist/reject patterns"
          >
            <Sparkles className="w-3 h-3 text-accent" />
            <span>Smart Rerank</span>
            {modelTrained && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Trained on your decisions" />
            )}
          </button>
        </div>

        {/* Blind Screening Mode Toggle */}
        <button
          type="button"
          onClick={onToggleBlindMode}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition border focus-ring ${
            blindMode
              ? "bg-accent-tint text-accent border-accent-border font-medium"
              : "bg-root text-secondary hover:text-primary border-subtle"
          }`}
          title="Blind Screening Mode: Masks candidate names and college for unbiased evaluations"
        >
          <EyeOff className="w-3 h-3" />
          <span className="hidden sm:inline">Blind Mode</span>
        </button>

        {/* View Switcher: Table vs Pipeline */}
        <div className="flex items-center p-0.5 rounded-md bg-root border border-subtle">
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={`p-1 rounded transition ${
              viewMode === "table" ? "bg-elevated text-primary shadow-xs" : "text-tertiary hover:text-primary"
            }`}
            title="Table View"
            aria-label="Table View"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("pipeline")}
            className={`p-1 rounded transition ${
              viewMode === "pipeline" ? "bg-elevated text-primary shadow-xs" : "text-tertiary hover:text-primary"
            }`}
            title="Pipeline (Kanban) View"
            aria-label="Pipeline (Kanban) View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Export CSV Button */}
        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-elevated hover:bg-overlay border border-subtle text-primary text-xs font-medium transition focus-ring"
            title="Download CSV report"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
