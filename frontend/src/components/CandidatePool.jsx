import { useState } from "react";
import { Panel, PanelHeader, Badge, EmptyState } from "./ui";
import {
  Users,
  Search,
  FileCode,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  UploadCloud,
} from "lucide-react";

const CandidatePool = ({
  resumes = [],
  hasJobDescription = false,
  onScreenCandidate,
  onNavigateToScreening,
  onLoadSample,
  loadingSample = false,
}) => {
  const [search, setSearch] = useState("");

  const filtered = resumes.filter((name) =>
    name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-primary tracking-tight">Candidate Pool</h1>
            <Badge variant="accent" dot>{resumes.length} Indexed</Badge>
          </div>
          <p className="text-xs text-secondary mt-0.5">
            Browse all candidate resumes currently indexed in ChromaDB and launch targeted AI screenings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToScreening}
            className="px-3 py-1.5 rounded-md bg-elevated hover:bg-overlay text-primary border border-subtle text-xs font-medium transition interactive-button focus-ring"
          >
            Upload More PDFs
          </button>
        </div>
      </div>

      {/* Directory Panel */}
      <Panel>
        <PanelHeader
          icon={Users}
          title="Indexed Candidate Directory"
          subtitle={
            hasJobDescription
              ? "Active job description configured for fit scoring"
              : "Tip: Add a job description in Candidate Screening for role-specific scoring"
          }
          action={
            resumes.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by filename…"
                  aria-label="Filter candidate resumes"
                  className="w-full pl-8 pr-3 py-1.5 bg-root border border-subtle rounded-md text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
                />
              </div>
            )
          }
        />

        {resumes.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={UploadCloud}
              title="No candidate resumes in the pool"
              description="Upload PDF resumes in the Candidate Screening workspace or load our 6 sample software engineer resumes to get started."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={onLoadSample}
                    disabled={loadingSample}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent hover:bg-accent-hover text-root text-xs font-semibold transition interactive-button focus-ring"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{loadingSample ? "Loading Sample…" : "Load Sample Candidates"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateToScreening}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-elevated hover:bg-overlay text-primary border border-subtle text-xs font-medium transition interactive-button focus-ring"
                  >
                    <span>Go to Upload</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-secondary">
            No candidates match <span className="font-mono text-primary">&ldquo;{search}&rdquo;</span>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-secondary">
              <thead className="bg-elevated border-b border-subtle text-micro font-medium text-tertiary uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Candidate Document</th>
                  <th className="px-5 py-3 hidden sm:table-cell">Format</th>
                  <th className="px-5 py-3">Vector Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {filtered.map((filename) => (
                  <tr key={filename} className="hover:bg-elevated/50 transition-colors cv-deferred-row">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-elevated border border-subtle flex items-center justify-center text-accent flex-shrink-0">
                          <FileCode className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-mono text-primary font-medium truncate max-w-[200px] sm:max-w-sm" title={filename}>
                          {filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell font-mono text-micro text-tertiary">
                      PDF
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="success">
                        <CheckCircle2 className="w-3 h-3" />
                        Indexed
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onScreenCandidate(filename)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent-tint hover:bg-accent-tint/80 text-accent border border-accent-border text-xs font-medium transition interactive-button focus-ring"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Screen Candidate</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

export default CandidatePool;
