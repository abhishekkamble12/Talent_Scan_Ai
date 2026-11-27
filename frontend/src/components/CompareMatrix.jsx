import React, { useState, useEffect } from "react";
import axios from "axios";
import { Check, X, AlertCircle, ArrowLeft, Layers, EyeOff } from "lucide-react";
import { ScoreRing } from "./ScoreRing";
import { Badge } from "./ui";
import { BACKEND_URL } from "../api/client";

export const CompareMatrix = ({
  jobId,
  candidateIds = [],
  onBack,
  onSelectCandidate,
  blindMode = false,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

  useEffect(() => {
    if (!jobId || !candidateIds.length) {
      setLoading(false);
      return;
    }

    const fetchMatrix = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await axios.post(`${BACKEND_URL}/api/jobs/${jobId}/compare`, {
          candidate_ids: candidateIds,
        });
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load comparison matrix.");
      } finally {
        setLoading(false);
      }
    };

    fetchMatrix();
  }, [jobId, candidateIds]);

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-secondary">Generating side-by-side evidence comparison matrix…</p>
      </div>
    );
  }

  if (error || !data || !data.candidates || data.candidates.length === 0) {
    return (
      <div className="p-8 text-center space-y-3 bg-surface border border-subtle rounded-lg">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="text-sm font-semibold text-primary">Comparison Unavailable</h3>
        <p className="text-xs text-secondary max-w-sm mx-auto">
          {error || "Select at least 2 candidates from the Candidates tab to compare their evidence matrix."}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-root font-semibold text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Candidates</span>
        </button>
      </div>
    );
  }

  const { candidates, matrix } = data;

  // Filter differences only if toggled
  const filteredRows = matrix.filter((row) => {
    if (!differencesOnly) return true;
    const verdicts = candidates.map((c) => row.candidates[c.id]?.verdict || "missing");
    return new Set(verdicts).size > 1;
  });

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="p-4 rounded-lg bg-surface border border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-md bg-elevated hover:bg-overlay border border-subtle text-secondary hover:text-primary transition"
            title="Back to Table"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-sm font-semibold text-primary">
              Candidate Comparison Matrix ({candidates.length} profiles)
            </h3>
            <p className="text-xs text-secondary mt-0.5">
              Side-by-side auditable evidence against all job requirements.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-secondary select-none">
            <input
              type="checkbox"
              checked={differencesOnly}
              onChange={(e) => setDifferencesOnly(e.target.checked)}
              className="rounded border-subtle bg-root text-accent focus:ring-accent"
            />
            <span className={differencesOnly ? "text-primary font-medium" : ""}>Differences only</span>
          </label>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="rounded-lg border border-subtle bg-surface overflow-x-auto">
        <table className="w-full text-left text-xs text-secondary border-collapse">
          <thead>
            <tr className="bg-elevated border-b border-subtle">
              <th className="p-4 min-w-[240px] text-primary font-semibold font-mono text-micro uppercase tracking-wider">
                Requirement ({filteredRows.length})
              </th>
              {candidates.map((cand, idx) => {
                const displayName = blindMode ? `Candidate #${idx + 1}` : cand.name;
                return (
                  <th
                    key={cand.id}
                    onClick={() => onSelectCandidate?.(cand.id)}
                    className="p-4 min-w-[180px] text-center border-l border-subtle cursor-pointer hover:bg-overlay/50 transition group"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <ScoreRing score={cand.fit_score} size="sm" />
                      <span className="font-semibold text-primary truncate max-w-[160px] group-hover:text-accent transition-colors">
                        {displayName}
                      </span>
                      <Badge variant="neutral" className="text-[10px]">
                        {cand.status.toUpperCase()}
                      </Badge>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {filteredRows.map((row) => (
              <tr key={row.requirement_id} className="hover:bg-elevated/40 transition-colors">
                {/* Requirement Cell */}
                <td className="p-4 align-top">
                  <div className="space-y-1">
                    <span className="font-medium text-primary block leading-snug">
                      {row.requirement_text}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-tertiary">
                      {row.category === "must_have" ? "[Must-Have]" : "[Nice-to-Have]"}
                    </span>
                  </div>
                </td>

                {/* Candidate Score Cells */}
                {candidates.map((cand) => {
                  const score = row.candidates[cand.id] || { verdict: "missing", evidence_quote: "" };
                  const isMet = score.verdict === "met";
                  const isPartial = score.verdict === "partial";

                  return (
                    <td
                      key={cand.id}
                      className="p-4 border-l border-subtle text-center align-top relative group"
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            isMet
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : isPartial
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {isMet ? "✓" : isPartial ? "◐" : "✗"}
                        </span>

                        {score.evidence_quote ? (
                          <div className="text-micro text-secondary text-left italic bg-root/60 p-2 rounded border border-subtle/60 line-clamp-3 hover:line-clamp-none transition-all">
                            &ldquo;{score.evidence_quote.replace(/^"|"$/g, "")}&rdquo;
                            {score.page_number && (
                              <span className="ml-1 text-accent font-mono not-italic block mt-1 text-[10px]">
                                Page {score.page_number}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-tertiary italic">No quote found</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CompareMatrix;
