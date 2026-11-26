import { useState, useEffect } from "react";
import axios from "axios";
import { Panel, PanelHeader, Badge, EmptyState } from "./components/ui";
import {
  Activity,
  Cpu,
  Clock,
  RefreshCw,
  Award,
  Layers,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { BACKEND_URL } from "./api/client";

const AIOpsDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [queries, setQueries] = useState([]);
  const [latencySeries, setLatencySeries] = useState([]);
  const [evalSeries, setEvalSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAIOpsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashRes, queryRes, latRes, evalRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/aiops/dashboard?last_n=50`, { timeout: 5000 }),
        axios.get(`${BACKEND_URL}/api/aiops/queries?limit=15`, { timeout: 5000 }),
        axios.get(`${BACKEND_URL}/api/aiops/latency?limit=20`, { timeout: 5000 }),
        axios.get(`${BACKEND_URL}/api/aiops/evaluations?limit=20`, { timeout: 5000 }),
      ]);

      setSummary(dashRes.data || null);
      setQueries(queryRes.data?.queries || []);
      setLatencySeries(latRes.data?.timeseries || []);
      setEvalSeries(evalRes.data?.timeseries || []);
    } catch (err) {
      console.error("Failed to load AIOps metrics:", err);
      setError("Unable to load observability metrics. Verify that the backend API is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIOpsData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchAIOpsData, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const hasData = summary && summary.total_queries > 0;
  const isInitialLoad = loading && !summary;

  return (
    <div className="space-y-6">
      {/* ── Page Header Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-primary tracking-tight">AI Performance &amp; Observability</h1>
            <Badge variant="accent" dot>Live Telemetry</Badge>
          </div>
          <p className="text-xs text-secondary mt-0.5">
            Track vector retrieval quality, pipeline latency, automated evaluation ratings, and query costs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-md border text-xs font-medium transition focus-ring ${
              autoRefresh
                ? "bg-accent-tint text-accent border-accent-border"
                : "bg-elevated text-secondary border-subtle hover:text-primary"
            }`}
          >
            {autoRefresh ? "Auto-sync: 10s" : "Auto-sync: Paused"}
          </button>

          <button
            type="button"
            onClick={fetchAIOpsData}
            disabled={loading}
            className="p-2 rounded-md bg-elevated text-secondary hover:text-primary hover:bg-overlay border border-subtle focus-ring interactive-button"
            title="Refresh metrics now"
            aria-label="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Error Banner State ── */}
      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-md bg-status-error-bg text-status-error border border-status-error-border text-xs flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAIOpsData}
            className="px-3 py-1 rounded-sm bg-status-error text-root font-semibold hover:opacity-90 transition focus-ring"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Key Performance Indicators ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isInitialLoad ? (
          <>
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
          </>
        ) : (
          <>
            <KPICell
              label="Total Queries"
              value={summary?.total_queries || 0}
              detail={`${summary?.success_rate ?? 100}% success · ${summary?.error_rate ?? 0}% error`}
            />
            <KPICell
              label="Avg End-to-End Latency"
              value={hasData ? `${Math.round(summary?.avg_e2e_latency_ms || 0)} ms` : "—"}
              detail={`P50: ${summary?.p50_latency_ms || 0}ms · P95: ${summary?.p95_latency_ms || 0}ms`}
            />
            <KPICell
              label="Mean Retrieval Similarity"
              value={hasData ? `${Number(summary?.avg_similarity_score || 0).toFixed(3)}` : "—"}
              detail={`${summary?.avg_chunks_retrieved || 0} chunks avg per query`}
            />
            <KPICell
              label="Estimated API Cost"
              value={`$${(summary?.total_estimated_cost_usd || 0).toFixed(4)}`}
              detail={`~$${((summary?.avg_cost_per_query_usd || 0) * 1000).toFixed(4)} per 1k queries`}
            />
          </>
        )}
      </div>

      {/* ── Time-Series Sparkline Trends (Latency & Quality) ── */}
      {hasData && (latencySeries.length > 1 || evalSeries.length > 1) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel>
            <PanelHeader
              icon={TrendingUp}
              title="End-to-End Latency Trend"
              subtitle={`Last ${latencySeries.length} queries (ms)`}
              action={<Badge variant="neutral" className="font-mono">P95: {summary?.p95_latency_ms || 0}ms</Badge>}
            />
            <div className="p-5">
              <MiniBarTrend
                data={latencySeries.map((d) => ({
                  label: d.query_id || `#${d.id}`,
                  value: Math.round(d.total_e2e_latency_ms || 0),
                }))}
                unit="ms"
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              icon={Award}
              title="Relevance Score Trend"
              subtitle={`Last ${evalSeries.length} evaluated queries (1–5)`}
              action={<Badge variant="accent" className="font-mono">Avg: {summary?.avg_answer_relevance || "—"}/5</Badge>}
            />
            <div className="p-5">
              <MiniBarTrend
                data={evalSeries.map((d) => ({
                  label: d.query_id || `#${d.id}`,
                  value: Number(d.answer_relevance || 0),
                }))}
                maxScale={5}
                unit="/5"
              />
            </div>
          </Panel>
        </div>
      )}

      {/* ── Analytical Split: Latency Breakdown vs Auto-Evaluation ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <PanelHeader
            icon={Clock}
            title="Latency by Pipeline Stage"
            subtitle="Average duration across embedding, vector search, and synthesis"
          />
          <div className="p-5 space-y-4">
            <div className="space-y-3.5">
              <LatencyMetricRow
                label="ChromaDB Vector Retrieval"
                value={summary?.avg_retrieval_latency_ms || 0}
                total={summary?.avg_e2e_latency_ms || 1}
              />
              <LatencyMetricRow
                label="Query Embedding Generation"
                value={summary?.avg_embedding_latency_ms || 0}
                total={summary?.avg_e2e_latency_ms || 1}
              />
              <LatencyMetricRow
                label="Gemini Flash Synthesis"
                value={summary?.avg_llm_latency_ms || 0}
                total={summary?.avg_e2e_latency_ms || 1}
              />
            </div>

            <div className="pt-4 border-t border-subtle grid grid-cols-3 text-center">
              <div>
                <div className="text-micro text-tertiary">P50 Median</div>
                <div className="text-sm font-mono text-primary font-semibold mt-0.5 tabular-nums">
                  {summary?.p50_latency_ms ? `${summary.p50_latency_ms} ms` : "—"}
                </div>
              </div>
              <div>
                <div className="text-micro text-tertiary">P95 Tail</div>
                <div className="text-sm font-mono text-status-warning font-semibold mt-0.5 tabular-nums">
                  {summary?.p95_latency_ms ? `${summary.p95_latency_ms} ms` : "—"}
                </div>
              </div>
              <div>
                <div className="text-micro text-tertiary">P99 Tail</div>
                <div className="text-sm font-mono text-status-error font-semibold mt-0.5 tabular-nums">
                  {summary?.p99_latency_ms ? `${summary.p99_latency_ms} ms` : "—"}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            icon={Award}
            title="Automated Quality Evaluation"
            subtitle="Async LLM-as-a-judge ratings (1.0 – 5.0 scale)"
          />
          <div className="p-5 space-y-3.5">
            <EvalDimensionBar
              label="Answer Relevance"
              score={summary?.avg_answer_relevance || 0}
              desc="Directly addresses the recruiter's screening question"
            />
            <EvalDimensionBar
              label="Context Groundedness"
              score={summary?.avg_groundedness || 0}
              desc="All claims are supported by retrieved resume text"
            />
            <EvalDimensionBar
              label="Structure & Coherence"
              score={summary?.avg_coherence || 0}
              desc="Clear formatting and actionable presentation"
            />
            <EvalDimensionBar
              label="Candidate Completeness"
              score={summary?.avg_completeness || 0}
              desc="Thorough coverage of matching skills and gaps"
            />
            <EvalDimensionBar
              label="Hallucination Guard"
              score={summary?.avg_hallucination_risk || 0}
              desc="5.0 indicates zero fabricated candidate details"
            />
          </div>
        </Panel>
      </div>

      {/* ── Operational Architecture Telemetry ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel>
          <PanelHeader
            icon={Cpu}
            title="Model Routing & Fallbacks"
            action={
              <Badge variant={summary?.total_fallbacks > 0 ? "warning" : "neutral"}>
                {summary?.total_fallbacks || 0} fallbacks
              </Badge>
            }
          />
          <div className="p-5">
            {summary?.model_distribution && Object.keys(summary.model_distribution).length > 0 ? (
              <div className="divide-y divide-subtle text-xs">
                {Object.entries(summary.model_distribution).map(([modelName, count]) => (
                  <div key={modelName} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                    <span className="font-mono text-primary truncate max-w-[240px]">{modelName}</span>
                    <span className="font-mono text-accent tabular-nums font-medium">{count} queries</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-tertiary py-4 text-center">No model executions recorded yet.</p>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            icon={Layers}
            title="Recent Ingestion Runs"
            action={<Badge variant="neutral">ChromaDB HNSW</Badge>}
          />
          <div className="p-5">
            {summary?.pipeline_runs && summary.pipeline_runs.length > 0 ? (
              <div className="divide-y divide-subtle text-xs">
                {summary.pipeline_runs.slice(0, 3).map((run, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <span className="text-secondary">
                      <strong className="text-primary font-medium tabular-nums">{run.documents_loaded}</strong> PDFs ·{" "}
                      <span className="font-mono tabular-nums">{run.chunks_created}</span> chunks
                    </span>
                    <span className="font-mono text-accent tabular-nums inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {Math.round(run.pipeline_latency_ms)} ms
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-tertiary py-4 text-center">No document ingestion runs recorded yet.</p>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Granular Query Audit Log ── */}
      <Panel>
        <PanelHeader
          icon={FileCheck2}
          title="Query Audit Log"
          subtitle="Per-request latency, retrieval similarity, and evaluation trace"
          action={<Badge variant="neutral">Last {queries.length} records</Badge>}
        />

        {queries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-secondary">
              <thead className="bg-elevated border-b border-subtle text-micro font-medium text-tertiary uppercase tracking-wider">
                <tr>
                  <th className="hidden sm:table-cell px-4 py-3 font-mono">Trace ID</th>
                  <th className="px-4 py-3">Screening Question</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="hidden md:table-cell px-4 py-3">Similarity</th>
                  <th className="px-4 py-3">Relevance</th>
                  <th className="hidden sm:table-cell px-4 py-3">Grounded</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {queries.map((q) => (
                  <tr key={q.id || q.query_id} className="hover:bg-elevated/50 transition-colors cv-deferred-row">
                    <td className="hidden sm:table-cell px-4 py-3 font-mono text-micro text-tertiary">
                      {q.query_id || `#${q.id}`}
                    </td>
                    <td className="px-4 py-3 text-primary max-w-xs truncate font-medium" title={q.question}>
                      {q.question}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-secondary">
                      {q.total_e2e_latency_ms ? `${Math.round(q.total_e2e_latency_ms)} ms` : "—"}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 font-mono tabular-nums text-secondary">
                      {q.avg_similarity_score ? q.avg_similarity_score.toFixed(3) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {q.answer_relevance ? (
                        <span className="text-accent font-medium">{q.answer_relevance}/5</span>
                      ) : (
                        <span className="text-tertiary italic font-sans">Evaluating…</span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 font-mono tabular-nums">
                      {q.groundedness ? (
                        <span className="text-accent font-medium">{q.groundedness}/5</span>
                      ) : (
                        <span className="text-tertiary italic font-sans">Evaluating…</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {q.status === "success" ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <Badge variant="error" title={q.error_message}>Error</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              icon={Activity}
              title="No screening queries recorded yet"
              description="Run a candidate screening question in the Candidate Screening workspace to stream live latency, retrieval, and evaluation metrics here."
            />
          </div>
        )}
      </Panel>
    </div>
  );
};

/* ── Zero-Dependency Mini Bar Trend ── */
const MiniBarTrend = ({ data = [], maxScale = null, unit = "" }) => {
  const maxVal = maxScale || Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      <div className="h-24 flex items-end gap-1.5 pt-2">
        {data.map((item, idx) => {
          const pct = Math.max(6, Math.min(100, Math.round((item.value / maxVal) * 100)));
          return (
            <div
              key={idx}
              className="flex-1 h-full flex items-end group relative"
              title={`${item.label}: ${item.value}${unit}`}
            >
              <div
                className="w-full bg-accent/60 group-hover:bg-accent rounded-t-sm transition-all duration-150"
                style={{ height: `${item.value > 0 ? pct : 4}%`, opacity: item.value > 0 ? 1 : 0.25 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] font-mono text-tertiary">
        <span>Oldest</span>
        <span>Latest ({data[data.length - 1]?.value ?? 0}{unit})</span>
      </div>
    </div>
  );
};

/* ── Minimalist KPI Cell ── */
const KPICell = ({ label, value, detail }) => (
  <div className="bg-surface border border-subtle rounded-lg p-4 space-y-1.5">
    <div className="text-micro font-medium text-tertiary truncate">{label}</div>
    <div className="text-xl font-bold font-mono text-primary tabular-nums tracking-tight">{value}</div>
    <div className="text-micro text-secondary font-mono truncate tabular-nums">{detail}</div>
  </div>
);

/* ── Skeleton Placeholder for Initial Load ── */
const KPISkeleton = () => (
  <div className="bg-surface border border-subtle rounded-lg p-4 space-y-2.5 animate-pulse">
    <div className="h-3 bg-elevated rounded w-24" />
    <div className="h-6 bg-elevated rounded w-16" />
    <div className="h-3 bg-elevated rounded w-32" />
  </div>
);

/* ── Precision Latency Bar Row ── */
const LatencyMetricRow = ({ label, value, total }) => {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-secondary">{label}</span>
        <span className="text-primary tabular-nums font-mono">
          {Math.round(value)} ms <span className="text-tertiary">({percent}%)</span>
        </span>
      </div>
      <div className="w-full h-1.5 bg-elevated rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

/* ── Precision Evaluation Dimension Gauge ── */
const EvalDimensionBar = ({ label, score, desc }) => {
  const val = score ? Math.min(5, Math.max(0, score)) : 0;
  const pct = Math.min(100, (val / 5) * 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-secondary font-medium">{label}</span>
        <span className="text-accent font-mono font-semibold tabular-nums">
          {val > 0 ? `${val.toFixed(1)} / 5.0` : "Pending"}
        </span>
      </div>
      <div className="w-full h-1.5 bg-elevated rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${val >= 3 || val === 0 ? "bg-accent" : "bg-status-warning"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-micro text-tertiary">{desc}</p>
    </div>
  );
};

export default AIOpsDashboard;
