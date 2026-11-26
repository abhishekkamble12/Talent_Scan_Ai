import { useState } from "react";
import axios from "axios";
import { Panel, PanelHeader, Badge } from "./ui";
import {
  Settings,
  Key,
  Database,
  Server,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { BACKEND_URL } from "../api/client";

const WorkspaceSettings = ({ status, onRefreshStatus }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleReset = async () => {
    setResetting(true);
    setFeedback(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/reset`);
      setFeedback({ type: "success", message: res.data.message || "Vector store and uploads cleared." });
      setConfirmReset(false);
      onRefreshStatus?.();
    } catch {
      setFeedback({ type: "error", message: "Failed to reset workspace storage." });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-primary tracking-tight">Workspace Settings</h1>
        <p className="text-xs text-secondary mt-0.5">
          Check API connections, vector database status, and manage stored resume records.
        </p>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3 rounded-md border text-xs flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-status-success-bg text-status-success border-status-success-border"
              : "bg-status-error-bg text-status-error border-status-error-border"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Environment & Models */}
      <Panel>
        <PanelHeader
          icon={Settings}
          title="Environment & AI Stack"
          subtitle="Live runtime configuration reported by the FastAPI backend"
          action={
            <button
              type="button"
              onClick={onRefreshStatus}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-elevated hover:bg-overlay text-secondary hover:text-primary border border-subtle text-xs transition focus-ring"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-check</span>
            </button>
          }
        />
        <div className="divide-y divide-subtle text-xs">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Server className="w-4 h-4 text-tertiary" />
              <div>
                <div className="font-medium text-primary">Backend REST API</div>
                <div className="text-micro text-tertiary font-mono">http://127.0.0.1:5000</div>
              </div>
            </div>
            <Badge variant={status.online ? "success" : "error"} dot>
              {status.online ? "Connected" : "Offline"}
            </Badge>
          </div>

          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-tertiary" />
              <div>
                <div className="font-medium text-primary">Google Gemini API Key</div>
                <div className="text-micro text-tertiary">Configured via root <code className="font-mono text-secondary">.env</code> file</div>
              </div>
            </div>
            <Badge variant={status.api_key_configured ? "success" : "warning"} dot>
              {status.api_key_configured ? "Configured" : "Missing Key"}
            </Badge>
          </div>

          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-tertiary" />
              <div>
                <div className="font-medium text-primary">ChromaDB Vector Index</div>
                <div className="text-micro text-tertiary">
                  {status.resumes_count} candidate {status.resumes_count === 1 ? "PDF" : "PDFs"} indexed ·{" "}
                  {status.has_job_description ? "Job description active" : "No job description"}
                </div>
              </div>
            </div>
            <Badge variant="neutral" className="font-mono">HNSW Local</Badge>
          </div>
        </div>
      </Panel>

      {/* Danger Zone */}
      <Panel className="border-status-error-border">
        <PanelHeader
          icon={Trash2}
          title="Danger Zone"
          subtitle="Permanently remove all uploaded resumes, job descriptions, and vector embeddings"
        />
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-secondary max-w-lg leading-relaxed">
            Resetting the workspace clears <code className="font-mono text-primary">uploads/</code> and deletes the local ChromaDB collection. AIOps query history in SQLite is preserved.
          </div>
          {confirmReset ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="px-3.5 py-2 rounded-md bg-status-error text-root text-xs font-semibold hover:opacity-90 transition focus-ring"
              >
                {resetting ? "Resetting…" : "Confirm Wipe"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                className="px-3 py-2 rounded-md bg-elevated text-secondary hover:text-primary border border-subtle text-xs transition focus-ring"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="px-3.5 py-2 rounded-md bg-status-error-bg text-status-error border border-status-error-border hover:bg-status-error hover:text-root text-xs font-semibold transition focus-ring flex-shrink-0"
            >
              Reset Vector Store
            </button>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default WorkspaceSettings;
