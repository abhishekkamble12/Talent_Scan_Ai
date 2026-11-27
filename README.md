# ◈ TalentScan AI — Job-Centric Candidate Intelligence & Auditable Screening

> An enterprise-grade AI resume screening and recruitment decision platform built with **FastAPI**, **SQLite**, **Retrieval-Augmented Generation (RAG)**, **ChromaDB**, and **Google Gemini Flash**.

---

## 🎯 Core Transformation

TalentScan AI has evolved from a simple "chat box over resumes" into a **job-centric recruitment workspace**:

```
Create Job → Upload Resumes → Auto-Screen → Ranked Shortlist
   → Candidate Detail (Evidence Citations) → Compare Matrix → Decide → Export
                         ↘ Scoped AI Copilot
```

| Old Chat-Only Paradigm | Redesigned TalentScan AI |
|---|---|
| Unstructured Markdown responses | **Auditable structured scoring schema** with page & quote citations |
| Recruiter had to type prompts | **Automated screening runs on upload** |
| Single flat list of resumes | **Job-centric workspaces** with editable Must-Have / Nice-to-Have chips |
| No persistent decisions | **Persisted candidate status** (Shortlisted, Maybe, Rejected) & notes in SQLite |
| Manual comparison | **Side-by-side comparison matrix** with differences-only toggle |

---

## 🌟 Key Capabilities

1. **Job Workspaces & Role Criteria Extraction**:
   - Paste a Job Description to automatically extract editable **Must-Have** (75% weight) and **Nice-to-Have** (25% weight) criteria chips.
   - Reorder, change categories, or add custom criteria on the fly.

2. **Automated Auditable Screening**:
   - Upload PDF resumes; screening executes automatically via SSE streaming.
   - Yields a **Ranked Candidate Table** with SVG Score Rings (green ≥75, amber 50-74, red <50), must-haves met ratios, and concise gap summaries (e.g., *"No K8s, AWS"*).

3. **Candidate Evidence Drawer**:
   - Click any candidate row to slide open an in-depth review drawer.
   - Verbatim resume quotes with **exact page number citations** (`"Built FastAPI microservices..." p.1`).
   - Automated detection of **Risk Flags** (e.g. timeline gaps > 6 months).
   - Generates 3 customized **technical interview questions** targeted to probe the candidate's gaps.
   - **One-click decisions**: `[Shortlist]`, `[Maybe]`, `[Reject]` with auto-saving recruiter notes.

4. **Candidate Comparison Matrix**:
   - Select 2–4 candidates to compare in a side-by-side grid of requirements vs. candidate evidence.
   - *"Differences only"* toggle highlights key differentiators between final candidates.

5. **Pipeline (Kanban) View**:
   - Toggle between standard Table view and an interactive Kanban board (`New` → `Maybe` → `Shortlisted` → `Rejected`).

6. **Blind Screening Mode**:
   - Single-click toggle to mask candidate names, files, and degrees for unbiased technical review.

7. **AIOps Telemetry & Insights**:
   - Engineering-grade observability tracking vector retrieval latencies, token costs, similarity distributions, and automated LLM-as-a-judge quality ratings.

8. **Export**:
   - Download complete ranked candidate evaluations and gap summaries as CSV reports.

---

## 🏗️ Architecture

```
User / Recruiter
      │
      ▼
┌──────────────────────────────────────────────────────────┐
│             React + Vite Frontend (Port 5173)            │
│  - Active Job Switcher & Workspace Tabs                  │
│  - Table & Kanban Pipeline Views                         │
│  - Right-Side Auditable Evidence Drawer                  │
│  - Side-by-Side Comparison Matrix                        │
│  - Scoped AI Recruiter Copilot                           │
└────────────────────────────┬─────────────────────────────┘
                             │ REST & SSE Streams
                             ▼
┌──────────────────────────────────────────────────────────┐
│              FastAPI Backend API (Port 5000)             │
│  - /api/jobs               : Create & manage workspaces  │
│  - /api/jobs/{id}/screen   : SSE auto-scoring pipeline   │
│  - /api/jobs/{id}/compare  : Side-by-side matrix         │
│  - /api/candidates/{id}    : Detail, evidence & status   │
│  - /api/jobs/{id}/export   : CSV report download         │
│  - /api/load-sample        : 1-click demo data seeder    │
└──────────────┬────────────────────────────┬──────────────┘
               │                            │
               ▼                            ▼
┌─────────────────────────────┐ ┌──────────────────────────┐
│     SQLite Database         │ │    ChromaDB Vector Store │
│  - jobs                     │ │    - PDF chunks & text   │
│  - requirements             │ │    - Gemini Embeddings   │
│  - candidates & fit scores  │ └──────────────────────────┘
│  - auditable scores table   │
└─────────────────────────────┘
```

---

## ⚡ Quickstart Guide

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & npm
- **Google Gemini API Key** (Free tier available at [Google AI Studio](https://aistudio.google.com/))

### 2. Configuration
Create or configure your `.env` file in the root directory:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
PORT=5000
```

### 3. Run the Project
**Option A — Single-Command Demo Script:**
```bat
start_project.bat
```

**Option B — Manual Startup:**
- **Terminal 1 (Backend - FastAPI)**:
  ```bash
  python backend/app.py
  ```
  *(Interactive API docs available at **http://localhost:5000/docs**)*
- **Terminal 2 (Frontend)**:
  ```bash
  cd frontend
  npm run dev
  ```

Open your browser at **http://localhost:5173**.

---

## 🎬 3-Minute Recruiter Demo Walkthrough

1. **One-Click Demo Setup**: Click the **"1-Click Demo Seed"** button in the left sidebar or top bar. In seconds, it creates a *Full Stack Software Engineer* job workspace, populates 6 candidate resumes, and auto-screens them.
2. **Review the Ranked Table**: Inspect the candidate fit scores (green/amber/red score rings), must-haves met (`6/7 ✓✓✓✓✓✓✗`), and identified gaps.
3. **Open Evidence Drawer**: Click on top candidate *A. Sharma* to review the 2-line AI summary, exact quote citations with PDF page numbers, and suggested interview questions.
4. **Make a Decision**: Click `[Shortlist]` and add recruiter notes.
5. **Compare Candidates**: Check 2-3 candidate rows and click `[Compare Matrix]` for a side-by-side verdict grid.
6. **Toggle Blind Mode**: Click `[Blind Mode]` in the filter bar to see names masked for unbiased evaluation.

---

## 🧪 Testing

Run backend unit and integration tests:
```bash
python -m pytest tests/test_redesign_api.py -v
```

---

## 📄 License
This project is licensed under the MIT License.
