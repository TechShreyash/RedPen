<p align="center">
  <img src="frontend/public/logo.png" alt="RedPen Logo" width="100" />
</p>

<h1 align="center">RedPen</h1>

<p align="center">
  <strong>Crossing out vulnerabilities AI left behind.</strong>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-features">Features</a> •
  <a href="#-local-development">Development</a> •
  <a href="#-deployment">Deployment</a>
</p>

---

## 🔍 What is RedPen?

**RedPen** is a local-first security vulnerability scanner purpose-built for the AI era. It parses your project's AST in seconds using [Semgrep](https://semgrep.dev/) to catch the invisible security debt that AI code generators (Copilot, Cursor, ChatGPT, etc.) routinely produce — then presents findings in a rich, interactive web dashboard with AI-generated titles powered by Gemini.

> Your code never leaves your machine. The scanner runs **100% locally**. Only the structured results are sent to the dashboard API for visualization.

---

## ⚡ Quick Start

Navigate to any project directory and run a single command:

**Linux / macOS:**

```bash
curl -sSL https://raw.githubusercontent.com/TechShreyash/RedPen/main/Scanner/scan.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/TechShreyash/RedPen/main/scan.ps1 | iex
```

The scanner will:

1. 📂 Collect your directory structure
2. 🔍 Run Semgrep with `--config auto` against your codebase
3. 📤 Upload structured results to the RedPen API
4. 🔗 Print a URL to view your results in the web dashboard

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER'S MACHINE                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Scanner (Python + Semgrep)                  │    │
│  │                                                         │    │
│  │  1. Walk directory → collect file list                  │    │
│  │  2. POST /api/scans/files → receive scan_id             │    │
│  │  3. Run semgrep scan --config auto --json               │    │
│  │  4. Process results (snippets, context, metadata)       │    │
│  │  5. POST /api/scans/results → upload findings           │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │ HTTPS                                 │
└─────────────────────────┼──────────────────────────────────────-┘
                          │
          ┌───────────────▼───────────────────────────────────────┐
          │                   CLOUD / SERVER                       │
          │                                                       │
          │  ┌─────────────────────────────────────────────────┐  │
          │  │         Backend API (FastAPI + Uvicorn)          │  │
          │  │                                                 │  │
          │  │  POST /api/scans/files      → save file tree    │  │
          │  │  GET  /api/scans/files/:id  → get file tree     │  │
          │  │  POST /api/scans/results    → save results      │  │
          │  │       └─ Gemini AI enrichment (titles)          │  │
          │  │  GET  /api/scans/results/:id → get results      │  │
          │  └──────────────┬──────────────────────────────────┘  │
          │                 │                                      │
          │  ┌──────────────▼──────────────────────────────────┐  │
          │  │            MongoDB (Motor async)                 │  │
          │  │                                                 │  │
          │  │  Collections:                                   │  │
          │  │    • file_structures  (scan_id, files, date)    │  │
          │  │    • scan_results     (scan_id, results, date)  │  │
          │  └─────────────────────────────────────────────────┘  │
          │                                                       │
          │  ┌─────────────────────────────────────────────────┐  │
          │  │       Frontend (React + Vite + Nginx)            │  │
          │  │                                                 │  │
          │  │  /              → HomePage (landing)             │  │
          │  │  /results/:id  → ResultsPage (dashboard)        │  │
          │  │  /scan/:id     → ScanResultsPage                │  │
          │  │                                                 │  │
          │  │  Components:                                    │  │
          │  │    FileTree, CodeViewer, VulnerabilityCard,     │  │
          │  │    StatsPanel, ScanProgress, SeverityBadge,     │  │
          │  │    PrismaticBurst (WebGL), CardSwap, TextType   │  │
          │  └─────────────────────────────────────────────────┘  │
          └───────────────────────────────────────────────────────┘
```

---

## ✨ Features

| Feature | Description |
|---|---|
| **AST-Powered Scanning** | Uses Semgrep's semantic analysis — not regex — for near-zero false positives |
| **Millisecond Analysis** | Scans complete before your CI pipeline starts |
| **OWASP & CWE Mapped** | Every finding links to industry-standard vulnerability databases |
| **100% Local Scanning** | Your source code never leaves your machine |
| **AI-Aware Rules** | Purpose-built to catch patterns AI code generators produce |
| **AI-Generated Titles** | Gemini AI summarizes each finding into a concise 3–6 word title |
| **Rich Dashboard** | Interactive code viewer with syntax highlighting, file tree, and severity badges |
| **Cross-Platform** | Bash script for Linux/macOS, PowerShell script for Windows |

### Detection Examples

- 🔍 **SQL Injection** — f-string queries, unsanitized inputs (CWE-89)
- 🔑 **Hardcoded Secrets** — JWT secrets, API keys in source (CWE-798)
- 🌐 **CORS Misconfiguration** — wildcard origins, permissive headers (CWE-942)
- 🛂 **Auth Bypass** — unverified JWT decodes, disabled signature checks (CWE-287)
- 🔓 **Broken Crypto** — MD5 hashing, weak algorithms (CWE-327)
- ⚠️ **XSS** — reflected untrusted input without sanitization (CWE-79)

---

## 📁 Project Structure

```
RedPen/
├── Scanner/                  # Local CLI scanner
│   ├── scanner.py            # Core scanning engine (Semgrep + result processing)
│   ├── scan.sh               # Bash wrapper script
│   └── cmds.txt              # Usage reference
│
├── backend/                  # FastAPI REST API
│   ├── main.py               # API routes & app setup
│   ├── database.py           # MongoDB connection (Motor async)
│   ├── gemini_summary.py     # Gemini AI title generation (multi-key load balancing)
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Production container (Python 3.12-slim)
│   └── .env                  # Environment variables (not committed)
│
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx           # Router (/, /results/:id, /scan/:id)
│   │   ├── api.js            # API service layer + polling
│   │   ├── pages/
│   │   │   ├── HomePage.*    # Landing page with WebGL background
│   │   │   ├── ResultsPage.* # Vulnerability dashboard with file tree
│   │   │   └── ScanResultsPage.* # Scan progress & results
│   │   └── components/
│   │       ├── FileTree/     # Project file navigator
│   │       ├── CodeViewer/   # Syntax-highlighted code with vulnerability markers
│   │       ├── VulnerabilityCard.*  # Finding detail card
│   │       ├── StatsPanel.*  # Severity breakdown stats
│   │       ├── ScanProgress/ # Animated scanning sequence
│   │       ├── PrismaticBurst/ # WebGL animated background
│   │       ├── CardSwap/     # Auto-rotating feature cards
│   │       └── TextType/     # Typewriter text effect
│   ├── Dockerfile            # Multi-stage build (Node → Nginx)
│   └── package.json
│
├── scan.ps1                  # Windows PowerShell scanner script
├── scan.sh                   # Linux/macOS scanner script (root-level)
└── README.md
```

---

## 🛠️ Local Development

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.12
- **MongoDB** (local instance or Atlas URI)
- **Semgrep** (`pip install semgrep`) — for the scanner
- **Gemini API Key(s)** — for AI title generation

### Backend

```bash
cd backend

# Create a .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
MONGO_DB=redpen
GEMINI_API_KEY_1=your_key_here
GEMINI_API_KEY_2=your_key_here   # optional, for load balancing
GEMINI_API_KEY_3=your_key_here   # optional
EOF

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies /api → localhost:8000)
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

### Scanner

```bash
cd Scanner

# Scan the current directory
uv run scanner.py

# Or from any project directory:
python scanner.py
```

---

## 🐳 Deployment

Both frontend and backend include production-ready Dockerfiles.

### Backend

```bash
cd backend
docker build -t redpen-api .
docker run -p 8000:8000 --env-file .env redpen-api
```

### Frontend

```bash
cd frontend
docker build -t redpen-web .
docker run -p 80:80 redpen-web
```

> **Coolify / PaaS:** Both Dockerfiles are optimized for one-click deployment on platforms like Coolify, Railway, or Fly.io.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` | ✅ | MongoDB connection string |
| `MONGO_DB` | ❌ | Database name (default: `redpen`) |
| `GEMINI_API_KEY_1` | ✅ | Google Gemini API key for AI titles |
| `GEMINI_API_KEY_2` | ❌ | Additional key for load balancing |
| `GEMINI_API_KEY_3` | ❌ | Additional key for load balancing |

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/scans/files` | Save file structure, returns `{ scan_id }` |
| `GET` | `/api/scans/files/:id` | Retrieve file structure for a scan |
| `POST` | `/api/scans/results` | Save scan results (triggers Gemini enrichment) |
| `GET` | `/api/scans/results/:id` | Retrieve scan results |

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Scanner Engine** | Python, Semgrep (AST analysis) |
| **Backend API** | FastAPI, Uvicorn, Pydantic |
| **Database** | MongoDB (Motor async driver) |
| **AI Enrichment** | Google Gemini API (Gemma 3 4B IT) |
| **Frontend** | React 18, Vite, React Router |
| **UI Effects** | WebGL (PrismaticBurst), CSS animations |
| **Containerization** | Docker (multi-stage builds), Nginx |
| **Deployment** | Coolify-ready Dockerfiles |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <strong>Built for Hackathon 2026</strong> • RedPen Security
</p>
