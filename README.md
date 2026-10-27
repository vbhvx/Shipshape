# Shipshape — AI-Powered Full-Stack Application Builder MVP

> Convert natural-language product requirements into complete, executable, inspectable Next.js + React + TypeScript applications with isolated cloud sandboxes, live preview, version diffs, automated repair loops, and zero-lock-in source export.

---

## 1. Product Overview & Purpose

Shipshape is a full-stack AI engineering platform that bridges the gap between conceptual product ideas and running software. Unlike chat-based code generation tools that produce disconnected snippets or nonfunctional mockups, Shipshape generates a **real, coherent multi-file project with genuine file manifests, working state persistence, interactive UI components, an isolated execution runtime, real-time diagnostics, and an immutable version history**.

### Primary Personas
- **Nontechnical Product Builders**: Guided natural-language requirement capture, editable application plans, visual status indicators, and live sandboxed previews without needing terminal commands.
- **Developers**: Navigable file tree, source code viewer/editor, syntax highlighting, line-by-line diffs, execution logs, test runners, and bounded iterative modification.
- **Technical Founders**: High-velocity idea validation with clean Next.js + React + TypeScript codebases that can be exported as `.zip` archives and deployed anywhere.

---

## 2. Architecture & High-Level Design

```text
Responsive Web Application (Next.js 16 + React 19 + Tailwind CSS)
            │
            ▼
Application API & Orchestrator (/api/v1/...)
            │
  ┌─────────┼───────────────────────────┐
  ▼         ▼                           ▼
Planning   Multi-File Generator      Isolated Sandbox Manager
Engine     (Next.js App Router)      (.sandboxes/<projectId>)
  │         │                           │
  ▼         ▼                           ▼
Zod Spec   File Manifest Safety      Isolated Port & Process
Validation Path Traversal Guard      Real stdout/stderr Streaming
  │         │                           │
  └─────────┼───────────────────────────┘
            ▼
      Bounded Repair Loop (Max 3 attempts, Error Diagnosis)
            │
            ▼
      Versioning & Diff Engine (Line-by-line structured diffs)
            │
            ▼
      Downloadable Source Export (Secret Scrubbing + .env.example + README)
            │
            ▼
      Persistent Storage (PostgreSQL DDL / Resilient Embedded Store)
```

### Key Architectural Principles
1. **Execution is the Source of Truth**: A project is not marked "working" merely because generation finished. It must pass structural validation, TypeScript compilation, and runtime startup in the sandbox.
2. **Bounded Agent Loops**: Automated repair is strictly bounded (maximum 3 attempts) to prevent runaway costs or infinite retry loops. If unresolved, a plain-language diagnosis is provided alongside the last-known-good version.
3. **Strict Isolation & Security Boundaries**:
   - Path traversal prevention (`validateSafePath`) blocks `..`, null bytes, drive letters, and unauthorized system access.
   - Secret scrubbing automatically redacts database passwords and API tokens from logs and exported code.
   - Live previews run inside an isolated origin iframe with restrictive security policies (`sandbox="allow-scripts allow-forms allow-same-origin allow-modals"`).
4. **Offline Reproducibility**: The platform includes a high-fidelity built-in engine that functions completely offline without requiring paid LLM keys, while seamlessly supporting Gemini and OpenAI when keys are configured.

---

## 3. Supported Application Template

### Next.js + React + TypeScript Full-Stack Template
- **Framework**: Next.js 14+ (App Router architecture)
- **Language**: TypeScript (`strict: true`, modern bundler resolution)
- **Styling**: Tailwind CSS with dark-mode tokens and responsive layouts
- **Routing**: Multi-page navigation (`/`, `/explore`, `/analytics`, `/settings`, `/api/health`)
- **Data Persistence**: Client-safe local storage synchronizer with initial curated seed records, reactive dispatch events, and mock REST API boundary
- **Interactive Workflows**:
  - Live CRUD table with modal creation and editing dialogs
  - Real-time search, multi-criteria category and priority filtering
  - Dynamic KPI metric calculation, status distribution progress bars
  - One-click client CSV data export

---

## 4. Repository Structure

```text
Shipshape/
├── prisma/
│   ├── schema.prisma           # Prisma schema with all 16 tables
│   └── schema.sql              # Raw PostgreSQL DDL with indexes and foreign keys
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/v1/             # REST & SSE API routes
│   │   │   ├── projects/       # Project CRUD & metadata
│   │   │   ├── generation-runs/# Job lifecycle, cancel & SSE events
│   │   │   └── preview/        # Sandboxed application preview proxy
│   │   ├── workspace/          # Deep-linkable multi-panel IDE workspace
│   │   ├── layout.tsx          # Root HTML layout & fonts
│   │   └── page.tsx            # Dashboard & project management overview
│   ├── components/
│   │   └── workspace/          # Modular IDE panels
│   │       ├── WorkspaceHeader.tsx
│   │       ├── ChatIterationPanel.tsx
│   │       ├── PlanSpecPanel.tsx
│   │       ├── VersionDiffPanel.tsx
│   │       ├── LivePreviewPanel.tsx
│   │       ├── CodeInspectorPanel.tsx
│   │       ├── DiagnosticsPanel.tsx
│   │       └── NewProjectModal.tsx
│   ├── modules/
│   │   ├── planning/           # Requirement interpretation & plan synthesis
│   │   ├── generation/         # Multi-file Next.js application generator
│   │   ├── sandbox/            # Isolated workspace runtime & validation
│   │   ├── repair/             # Bounded agent repair loop
│   │   ├── versioning/         # Line-by-line diff engine & restoration
│   │   └── export/             # Secret scrubbing & zip archive packaging
│   ├── server/
│   │   ├── jobs/               # Background orchestrator & event streaming
│   │   └── security/           # Safe paths & secret scrubber
│   ├── lib/
│   │   └── db/                 # Typed storage layer & demo seed script
│   └── types/                  # Typed interfaces & Zod validation schemas
├── tests/
│   ├── unit/                   # Safe paths, specs, diffs, and repair loop tests
│   └── integration/            # Full end-to-end generation & export test
├── .env.example                # Environment variables template
├── eslint.config.mjs           # ESLint configuration
├── vitest.config.ts            # Vitest runner configuration
└── package.json                # Project dependencies and scripts
```

---

## 5. Local Setup & Quickstart

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

### Installation
```bash
# 1. Clone the repository
git clone <repo-url>
cd Shipshape

# 2. Install dependencies
npm install

# 3. Configure environment variables (optional)
cp .env.example .env.local

# 4. Run automated tests
npm test

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The platform will automatically seed an initial showcase project (**TaskFlow Pro**) ready for immediate inspection, previewing, and editing.

---

## 6. End-to-End Workflow

1. **Describe Requirements**: Enter plain-language requirements in the dashboard or workspace prompt.
2. **Structured Planning**: The planning engine extracts target users, routes, core features, data entities, and acceptance criteria into an editable `ProjectSpecification`.
3. **Multi-File Generation**: The generator synthesizes complete Next.js configuration, TypeScript layouts, pages, components, and storage utilities.
4. **Validation & Sandbox Build**: Code is verified for manifest completeness, safe paths, and syntax errors in an isolated directory (`.sandboxes/<projectId>`).
5. **Live Sandboxed Preview**: The isolated runtime starts and serves an interactive preview inside a secure iframe with responsive desktop, tablet, and mobile viewport controls.
6. **Iterative Refinement**: Submit change instructions (e.g., *"Add priority filter badges and high contrast styling"*). The agent detects affected files, applies targeted modifications, updates the sandbox, and records a new version.
7. **Version History & Diff Inspection**: Inspect line-by-line additions and deletions across versions and restore any prior snapshot with one click.
8. **Source Code Export**: Download the complete application as a `.zip` archive, guaranteed free of platform secrets and equipped with a developer `README.md` and `.env.example`.

---

## 7. API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/projects` | `GET` | List active projects (auto-seeds demo on first visit) |
| `/api/v1/projects` | `POST` | Create a new project with name and description |
| `/api/v1/projects/:id` | `GET` | Get project metadata, active version, and sandbox status |
| `/api/v1/projects/:id` | `PATCH` | Update project properties |
| `/api/v1/projects/:id` | `DELETE` | Archive a project |
| `/api/v1/projects/:id/plan` | `POST` | Generate or update structured application plan |
| `/api/v1/projects/:id/generate` | `POST` | Start full multi-file code generation run |
| `/api/v1/projects/:id/modify` | `POST` | Submit an iterative change instruction |
| `/api/v1/projects/:id/files` | `GET` | Fetch project file tree or single file (`?path=...`) |
| `/api/v1/projects/:id/versions` | `GET` | List all version snapshots |
| `/api/v1/projects/:id/versions/:vid/diff` | `GET` | Get structured line-by-line diff against parent |
| `/api/v1/projects/:id/restore` | `POST` | Restore prior snapshot to a new active version |
| `/api/v1/projects/:id/export` | `GET` | Download clean source code archive (`.zip`) |
| `/api/v1/projects/:id/runtime/start` | `POST` | Spin up or restart isolated sandbox runtime |
| `/api/v1/projects/:id/runtime/stop` | `POST` | Terminate sandbox runtime |
| `/api/v1/projects/:id/runtime/logs` | `GET` | Fetch execution and build diagnostics logs |
| `/api/v1/generation-runs/:runId` | `GET` | Get run progress status, events, and metrics |
| `/api/v1/generation-runs/:runId/events` | `GET` | Server-Sent Events (SSE) stream for real-time progress |
| `/api/v1/generation-runs/:runId/cancel` | `POST` | Cancel active generation run |
| `/api/v1/preview/:projectId` | `GET` | Sandboxed interactive application preview proxy |

---

## 8. Verification & Test Suite

The platform includes unit and integration tests powered by Vitest:

```bash
# Run test suite
npm test

# Run linter
npm run lint

# Run production build
npm run build
```

### Verified Test Coverage
- `tests/unit/safe-paths.test.ts`: Workspace breakout prevention, traversal rejection, and secret scrubbing.
- `tests/unit/specification.test.ts`: Requirement extraction, route planning, data entity modeling.
- `tests/unit/diff.test.ts`: Line-by-line additions, deletions, and hunks computation.
- `tests/unit/repair-loop.test.ts`: Bounded retry loop (max 3 attempts) and automated syntax repair.
- `tests/integration/generation-workflow.test.ts`: Full end-to-end lifecycle from prompt to preview, iterative modification, diff verification, version restoration, and zip export.

---

## 9. Security & Isolation Model

- **Filesystem Isolation**: Generated files reside in isolated directories (`.sandboxes/<projectId>`) and cannot access host server directories.
- **Path Sanitization**: `validateSafePath` rejects `..`, null bytes, absolute paths, and restricted system folders (`.git`, `node_modules`, `.env`).
- **Secret Redaction**: Platform credentials (`DATABASE_URL`, API keys, tokens) are stripped from exported archives and execution logs.
- **Preview Origin**: Previews are isolated within an iframe with restrictive attributes (`sandbox="allow-scripts allow-forms allow-same-origin allow-modals"`).

---

## 10. License & Handoff

Built as an extensible, production-ready MVP for modern AI-assisted software engineering. All code generation, validation, and sandbox modules are modular and ready for deployment to containerized runners (Docker, AWS ECS, Fly.io, or Kubernetes).
