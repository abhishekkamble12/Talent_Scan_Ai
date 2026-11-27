import React from "react";
import { FileCode, GraduationCap, Briefcase, ChevronRight, Layers, Sparkles } from "lucide-react";
import { ScoreRing } from "./ScoreRing";
import { Badge } from "./ui";

export const RankedTable = ({
  candidates = [],
  selectedIds = [],
  onToggleSelect,
  onSelectCandidate,
  onCompareSelected,
  blindMode = false,
  sortMode = "fit_score",
}) => {
  return (
    <div className="relative rounded-lg border border-subtle bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-secondary">
          <thead className="bg-elevated/70 border-b border-subtle text-micro font-mono uppercase tracking-wider text-tertiary">
            <tr>
              <th className="w-10 px-4 py-3 text-center">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-4 py-3">Candidate</th>
              <th className="px-4 py-3 text-center">Fit</th>
              <th className="px-4 py-3">Must-Haves</th>
              <th className="px-4 py-3">Key Gaps</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {candidates.map((cand, idx) => {
              const isSelected = selectedIds.includes(cand.id);
              const displayName = blindMode ? `Candidate #${idx + 1}` : (cand.name || cand.filename);
              const displayEducation = blindMode ? "Degree on file (Blind Mode)" : cand.education;

              const mustMet = cand.must_haves_met || 0;
              const mustTotal = cand.must_haves_total || 0;

              return (
                <tr
                  key={cand.id}
                  onClick={() => onSelectCandidate(cand.id)}
                  className={`cursor-pointer transition-colors hover:bg-elevated/50 ${
                    isSelected ? "bg-accent-tint/20" : ""
                  }`}
                >
                  {/* Select Checkbox */}
                  <td
                    className="px-4 py-3 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(cand.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(cand.id)}
                      className="rounded border-subtle bg-root text-accent focus:ring-accent focus:ring-offset-root cursor-pointer"
                      aria-label={`Select ${displayName} for comparison`}
                    />
                  </td>

                  {/* Candidate Info */}
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-elevated border border-subtle flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-primary font-semibold text-xs leading-snug truncate">
                          {displayName}
                        </div>
                        <div className="flex items-center gap-2 text-micro text-tertiary mt-0.5">
                          {!blindMode && <span className="font-mono truncate max-w-[120px]">{cand.filename}</span>}
                          {cand.years_exp > 0 && (
                            <span className="inline-flex items-center gap-1 text-secondary">
                              <Briefcase className="w-3 h-3 text-tertiary" />
                              ~{cand.years_exp}y
                            </span>
                          )}
                        </div>
                        {displayEducation && (
                          <div className="inline-flex items-center gap-1 text-[11px] text-tertiary mt-0.5">
                            <GraduationCap className="w-3 h-3 text-tertiary" />
                            <span className="truncate max-w-[200px]">{displayEducation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Score Ring (Base or Smart Reranked) */}
                  <td className="px-4 py-3 text-center align-middle">
                    <div className="flex flex-col items-center justify-center">
                      <ScoreRing
                        score={sortMode === "smart_rerank" && cand.smart_score !== undefined ? cand.smart_score : (cand.fit_score || 0)}
                        size="sm"
                      />
                      {sortMode === "smart_rerank" && cand.smart_boost !== undefined && cand.smart_boost !== 0 && (
                        <span
                          className={`text-[9px] font-mono font-bold leading-none mt-1 ${
                            cand.smart_boost > 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                          title={`Recruiter feedback adjusted score by ${cand.smart_boost > 0 ? `+${cand.smart_boost}` : cand.smart_boost} pts`}
                        >
                          {cand.smart_boost > 0 ? `+${cand.smart_boost}` : cand.smart_boost}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Must-Haves Ratio & Chip Visuals */}
                  <td className="px-4 py-3 align-middle">
                    <div className="space-y-1">
                      <div className="font-mono text-xs font-semibold text-primary tabular-nums">
                        {mustMet}/{mustTotal}
                      </div>
                      {cand.score_breakdown && cand.score_breakdown.length > 0 ? (
                        <div className="flex items-center gap-0.5">
                          {cand.score_breakdown.filter((s) => s.category === "must_have").slice(0, 7).map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className={`text-[11px] font-bold ${
                                s.verdict === "met"
                                  ? "text-emerald-400"
                                  : s.verdict === "partial"
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              }`}
                              title={`${s.text}: ${s.verdict.toUpperCase()}`}
                            >
                              {s.verdict === "met" ? "✓" : s.verdict === "partial" ? "◐" : "✗"}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex gap-0.5">
                          {Array.from({ length: Math.min(6, mustTotal || 4) }).map((_, i) => (
                            <span
                              key={i}
                              className={`text-[11px] font-bold ${
                                i < mustMet ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {i < mustMet ? "✓" : "✗"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Key Gaps */}
                  <td className="px-4 py-3 align-middle max-w-xs">
                    <span className="text-secondary truncate block text-xs" title={cand.gaps}>
                      {cand.gaps || "No critical gaps detected"}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3 text-center align-middle">
                    <Badge
                      variant={
                        cand.status === "shortlisted"
                          ? "success"
                          : cand.status === "rejected"
                          ? "error"
                          : cand.status === "maybe"
                          ? "warning"
                          : "neutral"
                      }
                      dot
                    >
                      {cand.status ? cand.status.toUpperCase() : "NEW"}
                    </Badge>
                  </td>

                  {/* Action Link */}
                  <td className="px-4 py-3 text-right align-middle">
                    <span className="inline-flex items-center gap-1 text-xs text-accent font-medium group-hover:translate-x-0.5 transition-transform">
                      <span className="hidden sm:inline">Evidence</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Keyboard Shortcut Bar */}
      <div className="px-4 py-2 bg-elevated/40 border-t border-subtle flex flex-wrap items-center justify-between gap-2 text-[11px] text-tertiary">
        <span>Click any candidate row to inspect page-cited evidence</span>
        <div className="hidden sm:flex items-center gap-3 font-mono">
          <span><kbd className="px-1 py-0.5 rounded bg-root border border-subtle text-secondary">J</kbd>/<kbd className="px-1 py-0.5 rounded bg-root border border-subtle text-secondary">K</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-root border border-subtle text-secondary">S</kbd> shortlist</span>
          <span><kbd className="px-1 py-0.5 rounded bg-root border border-subtle text-secondary">R</kbd> reject</span>
        </div>
      </div>

      {/* Floating Compare Action Bar when candidates are selected */}
      {selectedIds.length >= 2 && onCompareSelected && (
        <div className="sticky bottom-4 left-0 right-0 mx-auto max-w-sm px-4 py-2.5 rounded-full bg-elevated/95 border border-accent shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 z-30 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Layers className="w-4 h-4 text-accent" />
            <span>{selectedIds.length} candidates selected</span>
          </div>
          <button
            type="button"
            onClick={onCompareSelected}
            className="px-3.5 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-root font-semibold text-xs transition interactive-button focus-ring"
          >
            Compare Matrix
          </button>
        </div>
      )}
    </div>
  );
};

export default RankedTable;
