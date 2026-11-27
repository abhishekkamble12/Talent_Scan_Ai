import React from "react";
import { ScoreRing } from "./ScoreRing";
import { Badge } from "./ui";
import { Briefcase, ChevronRight } from "lucide-react";

const COLUMNS = [
  { id: "new", title: "New Candidates", color: "border-tertiary" },
  { id: "maybe", title: "Maybe / Review", color: "border-amber-500/40" },
  { id: "shortlisted", title: "Shortlisted", color: "border-emerald-500/40" },
  { id: "rejected", title: "Rejected", color: "border-rose-500/40" },
];

export const PipelineBoard = ({
  candidates = [],
  onSelectCandidate,
  onStatusChange,
  blindMode = false,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {COLUMNS.map((col) => {
        const colCandidates = candidates.filter((c) => {
          if (col.id === "new") return !c.status || c.status === "new";
          return c.status === col.id;
        });

        return (
          <div
            key={col.id}
            className={`flex flex-col rounded-lg bg-surface border ${col.color} overflow-hidden`}
          >
            {/* Column Header */}
            <div className="p-3 bg-elevated/50 border-b border-subtle flex items-center justify-between">
              <span className="text-xs font-semibold text-primary font-mono uppercase tracking-wider">
                {col.title}
              </span>
              <span className="text-micro font-mono text-tertiary px-1.5 py-0.5 rounded bg-root border border-subtle">
                {colCandidates.length}
              </span>
            </div>

            {/* Candidate Cards */}
            <div className="p-2 space-y-2.5 min-h-[300px] max-h-[640px] overflow-y-auto">
              {colCandidates.map((cand, idx) => {
                const displayName = blindMode ? `Candidate #${idx + 1}` : (cand.name || cand.filename);
                return (
                  <div
                    key={cand.id}
                    onClick={() => onSelectCandidate(cand.id)}
                    className="p-3 rounded-md bg-elevated/70 border border-subtle hover:border-accent/50 cursor-pointer transition shadow-xs space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-primary leading-tight truncate group-hover:text-accent transition-colors">
                          {displayName}
                        </h4>
                        {!blindMode && (
                          <p className="text-[10px] font-mono text-tertiary truncate mt-0.5">
                            {cand.filename}
                          </p>
                        )}
                      </div>
                      <ScoreRing score={cand.fit_score} size="sm" />
                    </div>

                    {/* Must-Haves and Gaps */}
                    <div className="text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-secondary">
                        <span>Must-Haves:</span>
                        <span className="font-mono text-primary font-medium">
                          {cand.must_haves_met || 0}/{cand.must_haves_total || 0}
                        </span>
                      </div>
                      {cand.gaps && (
                        <p className="text-[10px] text-tertiary line-clamp-1 italic">
                          {cand.gaps}
                        </p>
                      )}
                    </div>

                    {/* Move Quick Status */}
                    <div className="pt-1 border-t border-subtle/50 flex items-center justify-between">
                      <span className="text-[10px] text-tertiary font-mono">Move:</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {col.id !== "shortlisted" && (
                          <button
                            type="button"
                            onClick={() => onStatusChange(cand.id, "shortlisted")}
                            className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30 transition"
                            title="Shortlist"
                          >
                            ✓
                          </button>
                        )}
                        {col.id !== "maybe" && (
                          <button
                            type="button"
                            onClick={() => onStatusChange(cand.id, "maybe")}
                            className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-semibold border border-amber-500/30 transition"
                            title="Maybe"
                          >
                            ◐
                          </button>
                        )}
                        {col.id !== "rejected" && (
                          <button
                            type="button"
                            onClick={() => onStatusChange(cand.id, "rejected")}
                            className="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-semibold border border-rose-500/30 transition"
                            title="Reject"
                          >
                            ✗
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {colCandidates.length === 0 && (
                <div className="py-8 text-center text-micro text-tertiary italic">
                  No candidates
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PipelineBoard;
