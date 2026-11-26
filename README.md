# 🤖 TalentScan AI — Intelligent Resume Screener

> An AI-powered resume screening and candidate analysis system built with **Retrieval-Augmented Generation (RAG)**, **LangChain**, **ChromaDB**, and **Google Gemini 1.5 Flash**.

![TalentScan AI Architecture](resume_screener.png)

---

## 🌟 Key Features

- **Automated PDF Resume Ingestion**: Parses, splits, and embeds PDF resumes into ChromaDB vector database.
- **RAG-Powered Candidate Q&A**: Uses hybrid similarity retrieval against the job description and candidate profiles to answer technical screening questions.
- **Candidate Pool Directory**: Filterable directory of all indexed candidate documents with direct 1-click evaluation triggers.
- **AI Performance & Observability (AIOps)**: Real-time telemetry tracking vector similarity, P50/P95 latency, token cost estimates, and automated LLM-as-a-judge quality ratings stored in SQLite.
- **1-Click Demo Pre-loader**: Instantly seeds the database with sample candidate resumes and a full Job Description for quick presentations.
- **Command Palette (`Ctrl+K`)**: Native `<dialog>` top-layer command palette for rapid view navigation and actions.
- **Modern Accessible UI**: Fluid SPA built with React 18, Vite, and TailwindCSS featuring the View Transitions API, auto-sizing inputs, and dark-mode native styling.
- **Markdown-Safe Output**: Renders structured candidate comparisons, skills matrices, and interview question suggestions safely with `react-markdown`.

---

## 🏗️ Architecture

```
User / Recruiter
      │
      ▼
┌──────────────────────────────────────────────────────────┐
│             React + Vite Frontend (Port 5173)            │
│  - Step 1: Upload Resumes & Target Job Description       │
│  - Step 2: Ask Questions / Suggested Query Chips        │
│  - Real-time Backend & Vector Store Status Badges       │
└────────────────────────────┬─────────────────────────────┘
                             │ REST API
                             ▼
┌──────────────────────────────────────────────────────────┐
│              FastAPI Backend API (Port 5000)             │
│  - /docs             : Interactive Swagger / OpenAPI UI  │
│  - /api/status       : System health, resumes count      │
│  - /api/upload       : Upload & index PDFs into Chroma   │
│  - /api/predict      : RAG query synthesis with Gemini   │
│  - /api/load-sample  : 1-click demo data seeder          │
│  - /api/reset        : Wipe uploads & vector DB          │
│  - /api/aiops/*      : Telemetry, latency & LLM judge    │
└────────────────────────────┬─────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌───────────────────────┐         ┌────────────────────────┐
│  ChromaDB Vector DB   │         │  Google Gemini 1.5     │
│  - Document chunks    │         │  - Embeddings-001      │
│  - Semantic search    │         │  - Gemini 1.5 Flash    │
└───────────────────────┘         └────────────────────────┘
```

---

## ⚡ Quickstart Guide

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & npm
- **Google Gemini API Key** (Free tier available at [Google AI Studio](https://aistudio.google.com/))

### 2. Environment Configuration
Create a `.env` file in the root directory (you can copy `.env.example`):
```bash
copy .env.example .env
```
Open `.env` and set your key:
```env
GOOGLE_API_KEY=AIzaSy...your_gemini_key_here
PORT=5000
```

### 3. Install Dependencies
```bash
# Python dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 4. Run the Project
**Option A — Docker Compose (recommended):**
```bash
docker compose up --build
```
Open **http://localhost:5173** (Frontend) and **http://localhost:5000/docs** (FastAPI Swagger UI).

**Option B — Local Demo Script:**
Launch both Backend and Frontend in one step:
```bat
start_project.bat
```
Or start them manually in two terminals:
- **Terminal 1 (Backend - FastAPI + Uvicorn)**:
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

## 🎬 3-Minute Live Demo Walkthrough

1. **Open the App**: Navigate to `http://localhost:5173`. Point out the system status badges in the top navbar (Backend Online, Resumes Count, API Key Status).
2. **One-Click Demo Setup**: Click the **"1-Click Demo Seed"** button in Step 1. In under 5 seconds, it loads 6 pre-bundled resumes and populates the Job Description without manual file searching.
3. **Execute AI Candidate Analysis**:
   - Click the prompt chip: *"Identify the top 3 candidates and explain why they fit this job description."*
   - Watch Gemini analyze the resumes against the JD context and generate structured rationale.
   - Click the prompt chip: *"Create a skills comparison matrix for all candidates against the requirements."*
   - Click *"Copy"* to grab the response.
4. **Custom Query**: Type a custom query, e.g.:
   > *"Which candidate has the most hands-on experience with Docker and CI/CD?"*

---

## 📁 Project Structure

```
resume-screener/
├── .env.example              # Sample environment configuration
├── requirements.txt          # Python package requirements
├── start_project.bat         # Single-command demo startup script
├── seed_demo_data.py         # Standalone CLI demo data seeder
├── aiops_metrics.db          # SQLite telemetry & LLM quality judge store
├── README.md                 # Project documentation
│
├── backend/
│   ├── app.py                # FastAPI REST API endpoints & AIOps routes
│   ├── rag_pipeline.py       # LangChain + ChromaDB pipeline
│   └── utils.py              # Gemini LLM invocation & prompt templates
│
├── bot/
│   └── data/pdfs/            # Bundled sample resumes for instant demo
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js     # Centralized Axios API instance & env config
│   │   ├── components/
│   │   │   ├── CandidatePool.jsx     # Indexed resume directory & filter
│   │   │   ├── CommandPalette.jsx    # Native <dialog> command palette (Ctrl+K)
│   │   │   ├── LandingView.jsx       # Platform overview
│   │   │   ├── WorkspaceSettings.jsx # Storage & API configuration
│   │   │   └── ui.jsx                # Reusable design system primitives
│   │   ├── AIOpsDashboard.jsx        # Live telemetry & LLM evaluation dashboard
│   │   ├── App.jsx                   # Layout, navigation drawer & view transitions
│   │   ├── ResumeUploader.jsx        # Accessible PDF upload & JD editor
│   │   └── LLMQueryComponent.jsx     # AI Q&A, prompt chips & report export
│   ├── index.html
│   └── package.json
│
└── uploads/                  # Storage for uploaded PDFs & active JD
```

---

## 📄 License
This project is licensed under the MIT License.
