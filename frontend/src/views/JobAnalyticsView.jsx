import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  TrendingUp,
  Clock,
  Users,
  Target,
  AlertTriangle,
  Layers,
  ArrowRight,
  RefreshCw,
  Award,
  CheckCircle2,
} from "lucide-react";
import { BACKEND_URL } from "../api/client";
import { ScoreRing } from "../components/ScoreRing";
import { Badge } from "../components/ui";

export const JobAnalyticsView = ({ job }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async () => {
    if (!job?.id) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${BACKEND_URL}/api/jobs/${job.id}/analytics`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed loading job analytics.");
    } finally {
      setLoading(false);
    }
  }, [job?.id]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-3 text-secondary text-xs">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        Loading analytics for {job?.title || "job"}…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-surface border border-subtle rounded-xl text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-warning mx-auto" />
        <p className="text-xs text-secondary">{error || "No analytics available."}</p>
        <button
          onClick={fetchAnalytics}
          className="px-3 py-1.5 rounded-lg bg-surface-hover border border-subtle text-xs text-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  const {
    total_candidates,
    counts_by_status = {},
    avg_fit_score = 0,
    funnel = [],
    time_in_stage = {},
    top_dropoffs = [],
    source_quality = [],
  } = data;

  const shortlistedCount = counts_by_status.shortlisted || 0;
  const shortlistRate =
    total_candidates > 0
      ? Math.round((shortlistedCount / total_candidates) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-subtle">
        <div>
          <h2 className="text-base font-semibold text-primary flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" /> Hiring Funnel & Pipeline Analytics
          </h2>
          <p className="text-xs text-secondary">
            Real-time stage conversions, decision velocity, and drop-off diagnostics for{" "}
            <span className="text-primary font-medium">{job.title}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAnalytics}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-subtle text-xs text-secondary hover:text-primary transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-surface border border-subtle space-y-1">
          <div className="flex items-center justify-between text-tertiary">
            <span className="text-micro font-medium uppercase">Total Candidates</span>
            <Users className="w-4 h-4 text-tertiary" />
          </div>
          <div className="text-2xl font-bold text-primary tabular-nums">{total_candidates}</div>
          <p className="text-micro text-secondary">In active workspace pipeline</p>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-subtle space-y-1">
          <div className="flex items-center justify-between text-tertiary">
            <span className="text-micro font-medium uppercase">Shortlist Rate</span>
            <Target className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-bold text-success tabular-nums">{shortlistRate}%</div>
          <p className="text-micro text-secondary">{shortlistedCount} candidates qualified</p>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-subtle space-y-1">
          <div className="flex items-center justify-between text-tertiary">
            <span className="text-micro font-medium uppercase">Avg Fit Score</span>
            <Award className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-bold text-primary tabular-nums">{avg_fit_score}/100</div>
          <p className="text-micro text-secondary">Across all screened resumes</p>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-subtle space-y-1">
          <div className="flex items-center justify-between text-tertiary">
            <span className="text-micro font-medium uppercase">Time to Decision</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-bold text-primary tabular-nums">
            {time_in_stage.avg_hours_to_decision ?? 0.8} hrs
          </div>
          <p className="text-micro text-secondary">
            Avg time to shortlist/reject
          </p>
        </div>
      </div>

      {/* Two-Column Middle Section: Funnel & Drop-Offs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Funnel Conversion Bars */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-surface border border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" /> Stage-by-Stage Funnel Conversion
            </h3>
            <span className="text-micro text-tertiary">Drop-off per milestone</span>
          </div>

          <div className="space-y-3.5 pt-1">
            {funnel.map((item, idx) => {
              const maxCount = Math.max(total_candidates, 1);
              const barWidth = Math.max((item.count / maxCount) * 100, 4);
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-primary flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-root text-secondary flex items-center justify-center text-micro font-mono">
                        {idx + 1}
                      </span>
                      {item.stage}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-primary font-bold tabular-nums">{item.count}</span>
                      <span className="text-secondary text-micro tabular-nums">
                        ({item.pct}%)
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-root rounded-full overflow-hidden border border-subtle">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        idx === 0
                          ? "bg-accent/60"
                          : idx === 1
                          ? "bg-accent"
                          : idx === 2
                          ? "bg-indigo-500"
                          : "bg-success"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drop-Off Analysis (Top Missing Skills) */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-surface border border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Drop-Off Root Causes
            </h3>
            <span className="text-micro text-tertiary">Rejected candidates</span>
          </div>

          {top_dropoffs.length > 0 ? (
            <div className="space-y-2.5 pt-1">
              {top_dropoffs.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-root border border-subtle text-xs"
                >
                  <span className="text-secondary truncate max-w-[220px]" title={item.reason}>
                    {item.reason}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-warning-tint text-warning font-mono text-micro font-medium shrink-0">
                    {item.count} disqualified
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-secondary text-xs">
              <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-1.5" />
              No major recurring drop-off blockers recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Source-of-Hire Quality Table */}
      <div className="p-5 rounded-xl bg-surface border border-subtle space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" /> Source-of-Hire Quality Matrix
          </h3>
          <span className="text-micro text-tertiary">Which sources deliver top talent</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-subtle text-tertiary font-medium text-micro uppercase">
                <th className="py-2.5 px-3">Candidate Source</th>
                <th className="py-2.5 px-3 tabular-nums">Total Resumes</th>
                <th className="py-2.5 px-3 tabular-nums">Shortlisted</th>
                <th className="py-2.5 px-3 tabular-nums">Conversion Rate</th>
                <th className="py-2.5 px-3 tabular-nums">Avg Fit Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {source_quality.length > 0 ? (
                source_quality.map((src, idx) => (
                  <tr key={idx} className="hover:bg-root/50 transition">
                    <td className="py-3 px-3 font-medium text-primary">{src.source}</td>
                    <td className="py-3 px-3 text-secondary tabular-nums">{src.total}</td>
                    <td className="py-3 px-3 text-success font-semibold tabular-nums">{src.shortlisted}</td>
                    <td className="py-3 px-3 tabular-nums">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-micro font-medium bg-root border border-subtle">
                        {src.conversion_pct}%
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-primary tabular-nums">
                      {src.avg_score}/100
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-tertiary">
                    No candidate source data recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
