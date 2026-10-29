# Shipshape — System Architecture & Technical Documentation
**Comprehensive Codebase Audit, Reverse-Engineered Architecture, and Operational Reference**

---

## 1. Executive Summary & System Overview

### 1.1 Purpose and Scope
**Shipshape** is an AI-assisted full-stack application generator and execution platform built on Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Prisma 7, and Clerk Authentication. Unlike simple chat interfaces that return isolated code snippets or mock layouts, Shipshape bridges requirement interpretation, multi-file software synthesis, static syntax verification, bounded agentic self-repair, real-time Server-Sent Events (SSE) telemetry, line-by-line version diffing, interactive in-browser preview simulation, and standalone zero-lock-in source export.

The core objective of Shipshape is to turn natural-language prompts (e.g., *"Build a high-performance Kanban sprint board with priority tagging, drag-and-drop columns, and CSV export"*) into working software projects. Projects feature immutable snapshot histories, live code navigation, and downloadable `.zip` archives configured for standard Node.js development.

### 1.2 High-Level Architecture Diagram

```mermaid
graph TD
    Client["Browser Client / React 19 UI<br/>(Landing, Projects, Workspace IDE)"]
    Proxy["Clerk Middleware / Proxy<br/>(src/proxy.ts)"]
    API["Next.js App Router API Routes<br/>(src/app/api/v1/...)"]
    Auth["Session & Tenant Security<br/>(src/lib/auth/session.ts)"]
    Orch["Project Orchestrator<br/>(src/server/jobs/orchestrator.ts)"]
    PlanEng["Planning Engine & Domain Catalog<br/>(src/modules/planning/)"]
    GenEng["Code Generator<br/>(Deterministic Engine / Gemini API)"]
    SanMan["Sandbox Manager<br/>(src/modules/sandbox/sandbox-manager.ts)"]
    RepLoop["Bounded Repair Loop<br/>(src/modules/repair/repair-loop.ts)"]
    DiffEng["Diff Engine & Versioning<br/>(src/modules/versioning/diff-engine.ts)"]
    ExpSvc["Export Service & Secret Scrubber<br/>(src/modules/export/export-service.ts)"]
    DBLayer["Database Access Layer<br/>(src/lib/db/index.ts)"]
    PrismaAdapter["Prisma PostgreSQL Adapter<br/>(Neon Serverless DB)"]
    JSONAdapter["Local JSON Store Adapter<br/>(.shipshape-data/store.json)"]
    SSE["SSE Event Stream<br/>(/api/v1/generation-runs/:id/events)"]
    Preview["Interactive Preview Proxy<br/>(/api/v1/preview/:projectId)"]

    Client -->|HTTPS Requests| Proxy
    Proxy --> API
    API --> Auth
    Auth --> DBLayer
    API --> Orch
    API --> Preview
    API --> ExpSvc
    API --> DiffEng

    Orch --> PlanEng
    Orch --> GenEng
    Orch --> SanMan
    SanMan --> RepLoop
    Orch --> DBLayer
    Orch --> SSE
    SSE -->|Live Telemetry| Client

    DBLayer -->|DATABASE_URL present| PrismaAdapter
    DBLayer -->|DATABASE_URL unset & dev mode| JSONAdapter
```

### 1.3 Technology Stack & Dependencies

| Layer | Technology | Version | Purpose in Codebase |
|---|---|---|---|
| **Framework** | Next.js | `16.4.3` | App Router, Server Functions, Dynamic API route handlers, Partial Prefetching (`ppr`), Turbopack. |
| **Runtime / UI** | React / React DOM | `19.3.0` | Server and Client Components (`'use client'`), interactive state, ref management, event sources. |
| **Language** | TypeScript | `^5` | Strict static typing (`strict: true`), interface declarations, build-time contract enforcement. |
| **Styling** | Tailwind CSS / Turbopack | `^4` / `@tailwindcss/turbopack` | Dark mode styling tokens, responsive grids, utilities, `@tailwindcss/turbopack` build loader. |
| **Authentication** | Clerk Next.js SDK | `^7.9.21` | Edge middleware (`clerkMiddleware`), user session management, `UserButton`, `SignIn`, `SignUp`. |
| **Database ORM** | Prisma Client & CLI | `^7.10.1` | PostgreSQL schema modeling, migrations (`prisma/migrations`), type-safe data access. |
| **Database Adapter** | `@prisma/adapter-pg` & `pg` | `^7.10.1` / `^8.23.1` | Neon PostgreSQL pooled connection execution using native Node.js pg driver. |
| **Validation** | Zod | `^4.6.7` | Runtime API payload schema validation for project creation, modification, planning, and runs. |
| **Archive Packaging** | JSZip | `^3.10.2` | In-memory `.zip` archive creation for clean, standalone project code export. |
| **Diff Calculation** | `diff` | `^9.0.0` | Unified patch generation (`structuredPatch`), hunk parsing, line additions/deletions. |
| **Icons** | Lucide React | `^1.61.0` | Accessible iconography for IDE panels, navigation, telemetry logs, and status badges. |
| **Testing** | Vitest | `^5.0.5` | Unit and integration test execution, lifecycle hardening, mock timers, and assertion suites. |
| **AI Integration** | Google Gemini REST API | `v1beta` | Optional structured JSON code generation (`gemini-3.5-flash`, `gemini-3.6-flash`). |

---

## 2. Directory & File Inventory

### 2.1 File Tree & Responsibilities

```text
Shipshape/
├── .agents/                               # Custom assistant tooling and skill definitions
│   └── skills/                            # Clerk management, setup, backend, webhooks, and org skills
├── .env.example                           # Canonical template of required/optional environment variables
├── .env.local                             # Active local environment variables (uncommitted)
├── .gitignore                             # Ignored patterns: node_modules, .next, .sandboxes, .shipshape-data
├── .sandboxes/                            # Local sandbox runtimes (ephemeral workspaces for project code)
├── .shipshape-data/                       # Local JSON database storage (.shipshape-data/store.json)
├── .vercelignore                          # Excluded build artifacts and local sandbox dirs for Vercel
├── AGENTS.md                              # Project documentation guidelines & Next.js 16 agent notes
├── eslint.config.mjs                      # Flat ESLint configuration referencing next/core-web-vitals
├── next-env.d.ts                          # Next.js TypeScript ambient type definitions
├── next.config.ts                         # Next.js configuration (cacheComponents, partialPrefetching, Turbopack)
├── package.json                           # Dependency definitions, metadata, and npm scripts
├── package-lock.json                      # Pinned dependency lockfile
├── prisma.config.ts                       # Prisma configuration referencing DIRECT_URL and schema path
├── prisma/
│   ├── migrations/                        # SQL migration history
│   │   ├── 20261028083000_init/           # Baseline table creation (users, projects, versions, files, etc.)
│   │   └── 20261028110000_nullable_plan_json/ # Schema adjustment making planJson nullable
│   ├── schema.prisma                      # Primary Prisma schema definition (16 models)
│   └── schema.sql                         # Raw PostgreSQL DDL reference script
├── public/                                # Public static assets (branding, icons, preview fixtures)
├── scripts/
│   ├── audit-json-migration.mjs           # Integrity verifier comparing JSON store against DB models
│   └── import-json-to-neon.mjs            # Production migration script transferring store.json to PostgreSQL
├── src/
│   ├── proxy.ts                           # Clerk edge middleware matcher configuration
│   ├── types/
│   │   └── index.ts                       # Core domain TypeScript interfaces and Zod API validation schemas
│   ├── app/
│   │   ├── layout.tsx                     # Root application layout with ClerkProvider & Geist font loading
│   │   ├── globals.css                    # Tailwind CSS 4 directives, root color variables, dark styling
│   │   ├── page.tsx                       # Public landing page, hero prompt input, architecture bento, preset simulator
│   │   ├── projects/
│   │   │   └── page.tsx                   # Project management hub (search, status filters, duplicate, delete, export)
│   │   ├── applications/
│   │   │   └── page.tsx                   # Conversational AI assistant interface for generating new applications
│   │   ├── workspace/
│   │   │   └── [projectId]/
│   │   │       └── page.tsx               # Primary IDE workspace: Split-screen editor, preview, diffs, chat, logs
│   │   ├── sign-in/[[...sign-in]]/page.tsx # Clerk dedicated authentication sign-in page
│   │   ├── sign-up/[[...sign-up]]/page.tsx # Clerk dedicated authentication registration page
│   │   └── api/v1/                        # Core REST and Streaming API endpoints
│   │       ├── projects/
│   │       │   ├── route.ts               # GET (list user projects), POST (create new project)
│   │       │   └── [projectId]/
│   │       │       ├── route.ts           # GET (project details), PATCH (update metadata), DELETE (soft-archive)
│   │       │       ├── duplicate/route.ts # POST (clone project, specification, versions, and files)
│   │       │       ├── specification/route.ts # GET (fetch spec), PATCH (update spec version)
│   │       │       ├── plan/route.ts      # POST (synthesize spec & plan from prompt), GET (read plan)
│   │       │       ├── generate/route.ts  # POST (trigger full multi-file application generation run)
│   │       │       ├── modify/route.ts    # POST (trigger targeted iterative modification run)
│   │       │       ├── files/route.ts     # GET (retrieve version file tree or specific file content)
│   │       │       ├── export/route.ts    # GET / POST (download scrubbed zip source archive)
│   │       │       ├── restore/route.ts   # POST (rollback prior version snapshot into new active version)
│   │       │       ├── versions/
│   │       │       │   ├── route.ts       # GET (list version history for project)
│   │       │       │   └── [versionId]/
│   │       │       │       ├── route.ts   # GET (fetch single version metadata and files)
│   │       │       │       └── diff/route.ts # GET (compute unified line-by-line diff vs parent)
│   │       │       └── runtime/
│   │       │           ├── start/route.ts  # POST (initialize workspace directory & sandbox preview session)
│   │       │           ├── stop/route.ts   # POST (terminate sandbox session)
│   │       │           ├── status/route.ts # GET (query current sandbox session status and port)
│   │       │           └── logs/route.ts   # GET (query build logs for specific run)
│   │       ├── generation-runs/
│   │       │   └── [runId]/
│   │       │       ├── route.ts           # GET (run status, events, build results, build logs)
│   │       │       ├── cancel/route.ts    # POST (durably abort running generation)
│   │       │       └── events/route.ts    # GET (SSE streaming event endpoint for real-time telemetry)
│   │       └── preview/
│   │           └── [projectId]/
│   │               └── [[...path]]/route.ts # GET (isolated, domain-aware preview HTML renderer)
│   ├── components/
│   │   ├── landing/                       # Landing page modular sections
│   │   │   ├── HeroPromptBox.tsx          # Natural language prompt input with preset chips & auth redirect
│   │   │   ├── HeroLoopingDemo.tsx        # High-framerate animated code generation preview
│   │   │   ├── ArchitectureBento.tsx      # Visual overview of sandboxing, repair loops, and diff engine
│   │   │   ├── ComparisonTable.tsx        # Matrix contrasting Shipshape with conventional AI assistants
│   │   │   ├── SecuritySection.tsx        # Zero-trust sandboxing and path containment highlights
│   │   │   ├── PricingBetaSection.tsx     # Tiered pricing layout for beta access
│   │   │   ├── FaqSection.tsx             # Collapsible FAQ accordion
│   │   │   └── LandingFooter.tsx          # Footer links, social links, and copyright
│   │   └── workspace/                     # Split-screen IDE panels
│   │       ├── WorkspaceHeader.tsx        # Breadcrumb, version selector, export button, runtime controls
│   │       ├── ChatIterationPanel.tsx     # Conversational modification prompt box & SSE step tracker
│   │       ├── PlanSpecPanel.tsx          # Structured application blueprint (routes, features, entities)
│   │       ├── LivePreviewPanel.tsx       # Sandboxed iframe with desktop/tablet/mobile viewport switchers
│   │       ├── CodeInspectorPanel.tsx     # File tree browser with search and syntax viewer
│   │       ├── VersionDiffPanel.tsx       # Line-by-line colored unified diff viewer with one-click restore
│   │       ├── DiagnosticsPanel.tsx       # Terminal log viewer & automated agent repair trigger
│   │       └── NewProjectModal.tsx        # Modal dialogue for creating new projects
│   ├── lib/
│   │   ├── project-utils.ts               # Name derivation algorithms and title cleanup helpers
│   │   ├── auth/
│   │   │   └── session.ts                 # Clerk identity verification, user provisioning, project authorization
│   │   └── db/
│   │       ├── index.ts                   # Universal database proxy (routes to Neon Prisma or local JSON store)
│   │       ├── prisma.ts                  # Prisma Client singleton initialization with @prisma/adapter-pg
│   │       ├── prisma-adapter.ts          # PostgreSQL adapter implementing all repository methods
│   │       └── seed.ts                    # Showcase project seeder (PulseStream, Kroma, AuraCraft, Veloce)
│   ├── modules/
│   │   ├── planning/
│   │   │   ├── domain-catalog.ts          # Curated domain taxonomy (todo, kanban, ecommerce, finance, CRM, etc.)
│   │   │   └── planning-engine.ts         # Requirement interpreter creating specs and plans from text
│   │   ├── generation/
│   │   │   └── generator.ts               # 1,900+ line deterministic generator synthesizing full Next.js apps
│   │   ├── ai/
│   │   │   └── gemini-provider.ts         # Google Gemini API connector with fallback, retries, and JSON schemas
│   │   ├── sandbox/
│   │   │   ├── sandbox-manager.ts         # Filesystem workspace builder & static validation runner
│   │   │   └── sandbox-provider.ts        # Pluggable sandbox interface (Local Temp, Daytona, E2B)
│   │   ├── repair/
│   │   │   └── repair-loop.ts             # Bounded diagnostic repair loop (max 3 automated patch attempts)
│   │   ├── versioning/
│   │   │   └── diff-engine.ts             # Myers diff calculation, hunk assembly, and version rollback logic
│   │   └── export/
│   │       └── export-service.ts          # Zip compiler, secret scrubbing, and README.md generator
│   └── server/
│       ├── jobs/
│       │   └── orchestrator.ts            # Orchestration engine managing generation/modification lifecycles
│       └── security/
│           └── safe-paths.ts              # Path traversal detection, normalization, and token redaction
└── tests/                                 # Automated Vitest test suite (12 files, 72 passing tests)
    ├── unit/
    │   ├── api-schemas.test.ts            # Zod validation schema verification
    │   ├── api-authorization.test.ts      # Multi-tenant IDOR protection & Clerk isolation checks
    │   ├── safe-paths.test.ts             # Path traversal and secret scrubber tests
    │   ├── specification.test.ts          # Planning engine & domain catalog unit tests
    │   ├── diff.test.ts                   # Unified diff calculation and additions/deletions tests
    │   ├── repair-loop.test.ts            # Bounded automated self-healing test
    │   ├── gemini-provider.test.ts        # Gemini AI client, retry backoff, and fallback tests
    │   ├── sandbox-provider.test.ts       # Sandbox handle and workspace filesystem tests
    │   ├── project-utils.test.ts          # Project title derivation and sanitization tests
    │   └── generation-lifecycle-hardening.test.ts # Atomic version publishing, cancellation, and timeout tests
    └── integration/
        ├── generation-workflow.test.ts    # Full generation, modification, and export lifecycle
        └── todo-app-end-to-end.test.ts    # P0 end-to-end build test: prompt to running todo app
```

---

## 3. Complete API & Endpoint Inventory

The system exposes 23 HTTP and streaming endpoints under `/api/v1/`. All operations require authenticated user sessions unless explicitly specified.

### 3.1 Endpoint Summary Matrix

| Method | Path | Controller File | Purpose | Auth |
|---|---|---|---|---|
| `GET` | `/api/v1/projects` | `src/app/api/v1/projects/route.ts` | List all non-archived projects owned by the caller. | Required (Clerk) |
| `POST` | `/api/v1/projects` | `src/app/api/v1/projects/route.ts` | Create a new project in `draft` status. | Required (Clerk) |
| `GET` | `/api/v1/projects/:projectId` | `src/app/api/v1/projects/[projectId]/route.ts` | Retrieve project metadata, active run, spec, and version. | Required (Owner) |
| `PATCH` | `/api/v1/projects/:projectId` | `src/app/api/v1/projects/[projectId]/route.ts` | Update project name, description, status, or active version. | Required (Owner) |
| `DELETE` | `/api/v1/projects/:projectId` | `src/app/api/v1/projects/[projectId]/route.ts` | Soft-archive project (`archivedAt` timestamp). | Required (Owner) |
| `POST` | `/api/v1/projects/:projectId/duplicate` | `src/app/api/v1/projects/[projectId]/duplicate/route.ts` | Clone project, spec, latest version, and files. | Required (Owner) |
| `GET` | `/api/v1/projects/:projectId/specification` | `src/app/api/v1/projects/[projectId]/specification/route.ts` | Fetch current structured project specification. | Required (Owner) |
| `PATCH` | `/api/v1/projects/:projectId/specification` | `src/app/api/v1/projects/[projectId]/specification/route.ts` | Incrementally update specification fields. | Required (Owner) |
| `POST` | `/api/v1/projects/:projectId/plan` | `src/app/api/v1/projects/[projectId]/plan/route.ts` | Synthesize blueprint specification and plan from prompt. | Required (Owner) |
| `GET` | `/api/v1/projects/:projectId/plan` | `src/app/api/v1/projects/[projectId]/plan/route.ts` | Retrieve current planned application blueprint. | Required (Owner) |
| `POST` | `/api/v1/projects/:projectId/generate` | `src/app/api/v1/projects/[projectId]/generate/route.ts` | Trigger full multi-file application generation. | Required (Owner) |
| `POST` | `/api/v1/projects/:projectId/modify` | `src/app/api/v1/projects/[projectId]/modify/route.ts` | Execute targeted natural-language code modification. | Required (Owner) |
| `GET` | `/api/v1/projects/:projectId/files` | `src/app/api/v1/projects/[projectId]/files/route.ts` | Fetch manifest file list or single file contents (`?path=...`). | Required (Owner) |
| `GET` | `/api/v1/projects/:projectId/export` | `src/app/api/v1/projects/[projectId]/export/route.ts` | Download clean `.zip` archive with scrubbed credentials. | Required (Owner) |
| `POST` | `/api/v1/projects/:projectId/export` | `src/app/api/v1/projects/[projectId]/export/route.ts` | Alternative POST trigger for file export. | Required (Owner) |
| `POST` | `/api/v1/projects/:projectId/restore` | `src/app/api/v1/projects/[projectId]/restore/route.ts` | Roll back prior version into a newly incremented version. | Required (Owner) |
| `GET` | `/api/v1/projects/:projectId/versions` | `src/app/api/v1/projects/[projectId]/versions/route.ts` | List all historical versions for the project. | Required (Owner) |
| `GET` | `/api/v1/projects/:projectId/versions/:versionId` | `src/app/api/v1/projects/[projectId]/versions/[versionId]/route.ts` | Fetch single version details and full file tree. | Required (Owner) |
| `GET` | `/api/v1/projects/:projectId/versions/:versionId/diff` | `src/app/api/v1/projects/[projectId]/versions/[versionId]/diff/route.ts` | Compute line-by-line diff vs parent or baseline. | Required (Owner) |
| `POST` | `/api/v1/projects/:projectId/runtime/start` | `src/app/api/v1/projects/[projectId]/runtime/start/route.ts` | Write files to temporary sandbox and activate runtime session. | Required (Owner) |
| `POST` | `/api/v1/projects/:projectId/runtime/stop` | `src/app/api/v1/projects/[projectId]/runtime/stop/route.ts` | Stop active sandbox session and update status. | Required (Owner) |
| `GET` | `/api/v1/projects/:projectId/runtime/status` | `src/app/api/v1/projects/[projectId]/runtime/status/route.ts` | Query sandbox port, host URL, and session state. | Required (Owner) |
| `GET` | `/api/v1/projects/:projectId/runtime/logs` | `src/app/api/v1/projects/[projectId]/runtime/logs/route.ts` | Fetch build and runtime logs for an active run. | Required (Owner) |
| `GET` | `/api/v1/generation-runs/:runId` | `src/app/api/v1/generation-runs/[runId]/route.ts` | Check run progress, events, logs, and build checks. | Required (Owner) |
| `POST` | `/api/v1/generation-runs/:runId/cancel` | `src/app/api/v1/generation-runs/[runId]/cancel/route.ts` | Durably cancel an active generation run. | Required (Owner) |
| `GET` | `/api/v1/generation-runs/:runId/events` | `src/app/api/v1/generation-runs/[runId]/events/route.ts` | Server-Sent Events (SSE) stream for live step progress. | Required (Owner) |
| `GET` | `/api/v1/preview/:projectId/[[...path]]` | `src/app/api/v1/preview/[projectId]/[[...path]]/route.ts` | Render interactive in-browser preview simulation. | Required (Owner) |

---

### 3.2 Exhaustive Endpoint Profiles

#### `POST /api/v1/projects`
- **Location**: `src/app/api/v1/projects/route.ts`
- **Purpose**: Creates a new project container associated with the authenticated user.
- **Auth**: `requireAuth()`. Returns `401 Unauthorized` if session is missing.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "name": "SprintFlow Kanban",
    "description": "High performance task manager with CSV export",
    "templateId": "nextjs-typescript"
  }
  ```
- **Validation**: `CreateProjectSchema` (`name`: string 1-100 chars; `description`: string 1-2000 chars; `templateId`: optional string).
- **Database Operations**: Inserts row into `projects` table (`status: "draft"`), records `project_created` in `audit_events`.
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "project": {
      "id": "proj_1793272800000_abc12",
      "ownerUserId": "usr_99a812...",
      "name": "SprintFlow Kanban",
      "description": "High performance task manager with CSV export",
      "status": "draft",
      "createdAt": "2026-10-29T16:00:00.000Z",
      "updatedAt": "2026-10-29T16:00:00.000Z"
    }
  }
  ```
- **Error Codes**: `400` (Validation failure), `401` (Unauthenticated), `500` (Internal server error).

#### `POST /api/v1/projects/:projectId/generate`
- **Location**: `src/app/api/v1/projects/[projectId]/generate/route.ts`
- **Purpose**: Synthesizes a full multi-file application codebase from a prompt or plan. Executes synchronously within the serverless request window (`maxDuration = 60s`).
- **Auth**: `requireAuth()` + `getOwnedProject(projectId, user.id)`. Returns `404 Not Found` if the project does not exist or belongs to another user.
- **Request Body**:
  ```json
  {
    "prompt": "Build a Kanban board with 3 columns and local persistence",
    "modelProvider": "deterministic"
  }
  ```
- **Validation**: `GenerateRequestSchema` (`prompt` 3-5000 chars or structured `plan` object; `modelProvider`: `'gemini' | 'deterministic'`).
- **Concurrency Control**: Queries `db.getLatestGenerationRun(projectId)`. If an active run exists and is under 2 minutes old, rejects with `409 Conflict`. If over 2 minutes old, auto-fails the stale run with `RUN_TIMEOUT`.
- **Lifecycle Operations**:
  1. Creates `generation_runs` record with `status: "queued"`.
  2. Updates project `status: "generating"`.
  3. Invokes `ProjectOrchestrator.runFullGeneration(runId, projectId, plan)`.
  4. Runs planning, code generation (deterministic or Gemini), manifest checks, JSON syntax validation, repair loop (if needed), temporary workspace file creation, and atomic version publication.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "runId": "run_1793272800000_xyz89",
    "status": "completed",
    "message": "Generation completed successfully",
    "run": {
      "id": "run_1793272800000_xyz89",
      "projectId": "proj_...",
      "status": "completed",
      "resultVersionId": "ver_..."
    }
  }
  ```
- **Error Codes**: `400` (Malformed payload), `401` (Auth), `404` (Project not found / unauthorized), `409` (Active run in progress), `500` (Orchestration exception).

#### `POST /api/v1/projects/:projectId/modify`
- **Location**: `src/app/api/v1/projects/[projectId]/modify/route.ts`
- **Purpose**: Executes an iterative refinement against an existing version snapshot.
- **Auth**: Verified owner.
- **Request Body**:
  ```json
  {
    "instruction": "Add priority color tags and high-contrast styling",
    "baseVersionId": "ver_1793272800000_123"
  }
  ```
- **Validation**: `ModifyRequestSchema` (`instruction`: string 3-5000 chars; `baseVersionId`: optional string).
- **Execution Flow**:
  1. Validates base version belongs to target project.
  2. Spawns `generation_runs` (`runType: "modification"`).
  3. Calls `ProjectOrchestrator.runModification(...)`.
  4. Modifies target files via Gemini or deterministic parser.
  5. Validates syntax and executes `BoundedRepairLoop` if syntax errors are detected.
  6. Atomically commits a new version increment (e.g. `v2`) referencing `parentVersionId`.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "runId": "run_mod_1793272800000_mod42",
    "status": "completed",
    "message": "Modification completed successfully"
  }
  ```

#### `GET /api/v1/generation-runs/:runId/events`
- **Location**: `src/app/api/v1/generation-runs/[runId]/events/route.ts`
- **Protocol**: HTTP/1.1 Server-Sent Events (`text/event-stream`).
- **Headers Returned**:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
- **Event Dispatch Protocol**:
  - Dispatches `event: message` with data payload of `GenerationEvent` (contains monotonically increasing `sequenceNumber`).
  - Dispatches `event: status` with `{ status: "planning" | "generating" | ... }`.
  - Dispatches `event: done` when run enters `completed`, `failed`, or `cancelled`.
  - Dispatches `event: error` on fatal errors.
- **Safety Mechanism**: Includes a 500ms polling interval with an abort signal listener (`req.signal.addEventListener('abort')`) and a 120-second watchdog auto-closer.

#### `GET /api/v1/projects/:projectId/export`
- **Location**: `src/app/api/v1/projects/[projectId]/export/route.ts`
- **Purpose**: Packages all generated files for the active version into a downloadable zip archive.
- **Auth**: Verified owner.
- **Headers Returned**:
  - `Content-Type: application/zip`
  - `Content-Disposition: attachment; filename="<project-name>-v<version>.zip"`
  - `X-Export-Files-Count: 16`
- **Security Control**: Content passes through `scrubSecrets(content)` in `src/server/security/safe-paths.ts`, redacting database credentials, private keys, and sensitive tokens.

#### `GET /api/v1/preview/:projectId/[[...path]]`
- **Location**: `src/app/api/v1/preview/[projectId]/[[...path]]/route.ts`
- **Purpose**: Returns complete, self-contained HTML rendering the generated application directly in an iframe.
- **Security Headers**:
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Domain Awareness**: Inactive/mock previews infer domain semantics (`inferDomain`) to render interactive views with local browser storage (`localStorage`), CRUD modal interactions, search filtering, and metric calculation without invoking external compilers.

---

## 4. Frontend Architecture & User Workflows

### 4.1 Page Routing & Layout Structure

The frontend is implemented using Next.js App Router client components with selective partial prerendering.

```mermaid
graph TD
    RootLayout["Root Layout (src/app/layout.tsx)<br/>ClerkProvider + Geist Fonts"]
    HomePage["Landing Page (src/app/page.tsx)<br/>Hero Prompt, Architecture Bento, Preset Demos"]
    ProjectsPage["Projects Page (src/app/projects/page.tsx)<br/>Management Grid, Search, Filter, Duplicate, Delete"]
    AppsPage["Applications Page (src/app/applications/page.tsx)<br/>Conversational Assistant Interface"]
    WorkspacePage["Workspace IDE (src/app/workspace/[projectId]/page.tsx)<br/>Split-Screen IDE with SSE Stream, Live Preview, Diff Viewer"]
    SignIn["Sign In (src/app/sign-in/[[...sign-in]]/page.tsx)"]
    SignUp["Sign Up (src/app/sign-up/[[...sign-up]]/page.tsx)"]

    RootLayout --> HomePage
    RootLayout --> ProjectsPage
    RootLayout --> AppsPage
    RootLayout --> WorkspacePage
    RootLayout --> SignIn
    RootLayout --> SignUp
```

### 4.2 Workspace Component Breakdown

The workspace (`src/app/workspace/[projectId]/page.tsx`) provides a full-featured IDE interface divided into two primary viewports:

```text
+----------------------------------------------------------------------------------------------------+
|  WorkspaceHeader.tsx                                                                               |
|  [Logo] Project Name  |  Version Dropdown [v1, v2]  |  [Restart Sandbox]  [Export .ZIP]  [User]    |
+--------------------------------------------------+-------------------------------------------------+
|  LEFT PANEL (Width: 460px - 500px)               |  RIGHT PANEL (Flex-1 Fill)                      |
|  Tabs: [Chat Iteration] | [Plan Spec] | [Diffs]  |  Tabs: [Live Preview] | [Code] | [Diagnostics]  |
|--------------------------------------------------+-------------------------------------------------|
|  IF tab == 'chat':                               |  IF tab == 'preview':                           |
|    - ChatIterationPanel.tsx                      |    - LivePreviewPanel.tsx                       |
|    - Conversational prompt history               |    - Viewport toggles (Desktop/Tablet/Mobile)   |
|    - Step-by-step pipeline tracker               |    - Sandboxed iframe (/api/v1/preview/...)     |
|    - Quick action chips                          |                                                 |
|                                                  |  IF tab == 'code':                              |
|  IF tab == 'plan':                               |    - CodeInspectorPanel.tsx                     |
|    - PlanSpecPanel.tsx                           |    - File tree browser with search filter       |
|    - Planned Routes, Features, Data Entities     |    - Line-numbered source viewer & copy button  |
|                                                  |                                                 |
|  IF tab == 'versions':                           |  IF tab == 'logs':                              |
|    - VersionDiffPanel.tsx                        |    - DiagnosticsPanel.tsx                       |
|    - Unified color-coded diff viewer (+ / -)     |    - Monospaced terminal build/execution logs   |
|    - "Restore This Version" rollback trigger     |    - "Auto-Repair with AI Agent" trigger        |
+--------------------------------------------------+-------------------------------------------------+
```

### 4.3 State Management & Telemetry Synchronization

1. **Local Component State**: Panels maintain state locally using React hooks (`useState`, `useRef`, `useMemo`).
2. **Real-Time SSE Streaming**:
   - When a generation or modification run triggers, the frontend opens an `EventSource` connection to `/api/v1/generation-runs/:runId/events`.
   - Incoming `message` events append sequentially to `events`.
   - Incoming `status` events update the step progress indicators.
   - Upon receiving `done` or terminal states, the connection closes and `reloadVersionsAndFiles()` executes.
3. **Resilient Polling Fallback**:
   - In environments where Server-Sent Events are interrupted, a 1500ms `setInterval` fallback queries `/api/v1/generation-runs/:runId` directly.
4. **Watchdog Timer**:
   - A 60-second client-side watchdog releases the `isProcessing` lock if a network disconnect prevents the arrival of terminal signals.

### 4.4 Authentication UX & Autostart Navigation

1. An unauthenticated visitor can type a prompt in `HeroPromptBox` or `ApplicationsChatPage`.
2. When the user clicks **Generate App**, the frontend detects the unauthenticated state (`401` from API or Clerk hook).
3. The prompt is stored in browser `sessionStorage` under `shipshape_pending_prompt`.
4. The user is redirected to Clerk Sign-In with `redirect_url=/?autostart=true`.
5. Upon authentication, the landing page detects the query parameter, reads the prompt from `sessionStorage`, provisions the project, and routes directly to `/workspace/:projectId?autostart=true`.

### 4.5 UI vs Backend Inconsistencies & Simulation Artifacts

- **Simulated Preset Code vs Generated Code**: On the landing page (`src/app/page.tsx`), the preset simulator displays hardcoded snippets (`SprintFlow Kanban`, `PulseMetrics AI`, `Velour Store`) designed for presentation speed. When a user clicks **Generate**, the backend generates a complete 16-file Next.js application tailored to the prompt.
- **Port Displays**: In `LivePreviewPanel.tsx`, the top bar renders `sandbox-<sanitizedId>.shipshape.run` with a simulated green status light. In local execution, the iframe renders through `/api/v1/preview/:projectId` within the same Next.js process.

---

## 5. Backend Architecture & Business Logic

### 5.1 Request Pipeline & Middleware

```mermaid
sequenceDiagram
    autonumber
    actor Client as Web Browser
    participant Proxy as clerkMiddleware (src/proxy.ts)
    participant Route as Route Handler (/api/v1/...)
    participant Auth as requireAuth() (src/lib/auth/session.ts)
    participant DB as Database Proxy (src/lib/db/index.ts)
    participant Orch as ProjectOrchestrator (src/server/jobs/orchestrator.ts)

    Client->>Proxy: POST /api/v1/projects/:id/generate
    Note over Proxy: Matches API routes, resolves Clerk session JWT
    Proxy->>Route: Forward Request
    Route->>Auth: requireAuth()
    Auth->>DB: getUserByClerkId(userId)
    alt User exists in Shipshape DB
        DB-->>Auth: Return User entity
    else First visit / JIT provisioning
        Auth->>Auth: Retrieve verified email from currentUser()
        Auth->>DB: createUser({ clerkId, email, name })
        DB-->>Auth: Created User entity
    end
    Auth-->>Route: Authenticated User
    Route->>Auth: getOwnedProject(projectId, user.id)
    Auth->>DB: getProject(projectId)
    DB-->>Auth: Project record
    alt Not owner or does not exist
        Auth-->>Route: null
        Route-->>Client: 404 Not Found (IDOR protection)
    else Verified Owner
        Auth-->>Route: Verified Project
        Route->>Orch: runFullGeneration(...)
        Orch-->>Route: { success: true, versionId: "..." }
        Route-->>Client: 200 OK
    end
```

### 5.2 Planning Engine & Domain Taxonomy

- **Entry Point**: `src/modules/planning/planning-engine.ts` (`createPlanFromPrompt`).
- **Domain Catalog** (`src/modules/planning/domain-catalog.ts`):
  Evaluates keywords against standard domains:
  - `todo`: Tasks, checklists, reminders, habits.
  - `kanban`: Agile sprints, boards, drag-and-drop, workflow stages.
  - `ecommerce`: Products, shopping carts, checkout, catalog, inventory.
  - `finance`: Transactions, accounts, budgets, expenses, investments.
  - `crm`: Deals, contacts, pipelines, investors, founders.
  - `notes`: Markdown documents, tags, notebooks, scratchpads.
  - `fitness`: Workouts, exercises, sets, reps, logging.
  - `general`: Default entity model with status, categories, and metrics.
- **Specification Generation**: Produces a `ProjectSpecification` containing structured routes (`/`, `/explore`, `/analytics`, `/settings`), features, data entities, design parameters, and acceptance criteria.

### 5.3 Code Generation Engine

Code generation is implemented via two distinct strategies coordinated by `ProjectOrchestrator`:

1. **Deterministic Domain Catalog Generator (`src/modules/generation/generator.ts`)**:
   - Synthesizes 16 production-grade files without external LLM dependencies.
   - Outputs:
     - `package.json`: Configured with Next.js 16, React 18/19, Lucide, Tailwind.
     - `tsconfig.json`: Strict TypeScript settings.
     - `tailwind.config.js`, `postcss.config.js`, `next.config.mjs`.
     - `src/app/layout.tsx`, `src/app/globals.css`.
     - `src/app/page.tsx` (Dashboard view with KPI metric calculation).
     - `src/app/explore/page.tsx` (Interactive data management table).
     - `src/app/analytics/page.tsx` (Visual distribution charts).
     - `src/app/settings/page.tsx` (Theme toggle, local data reset, CSV export).
     - `src/app/api/health/route.ts` & `src/app/api/items/route.ts`.
     - `src/components/HeaderNav.tsx`, `DashboardView.tsx`, `DataManagementTable.tsx`, `ItemModal.tsx`.
     - `src/lib/store.ts` (Reactive browser storage with custom dispatch events).
     - `src/lib/csv-export.ts` (RFC 4180 compliant CSV string formatter).
     - `README.md` (Standalone local run instructions).
2. **Google Gemini AI Provider (`src/modules/ai/gemini-provider.ts`)**:
   - Activated when `GEMINI_API_KEY` is present.
   - Issues a REST `POST` request to `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`.
   - Enforces strict JSON Schema validation matching `files: [{ path, responsibility, fileType, content }]`.
   - Automatic fallback: If rate-limited (`429`), server-error (`503`), or network-unreachable, it logs diagnostic telemetry and falls back to the deterministic generator.

### 5.4 Bounded Automated Repair Loop

- **Location**: `src/modules/repair/repair-loop.ts` (`BoundedRepairLoop`).
- **Constraint**: `MAX_ATTEMPTS = 3`.
- **Diagnostic Heuristics**:
  1. *JSON Syntax Faults*: Parses invalid JSON files (e.g. trailing commas, missing braces), applies regex sanitization, or replaces with safe structural defaults.
  2. *Missing Manifest Files*: Detects missing required files (e.g. `src/app/layout.tsx`) and synthesizes valid minimal TypeScript stubs.
  3. *Whitespace & Syntax Normalization*: Cleans trailing invalid characters in `.ts` and `.tsx` files.
- **Outcome**: Re-runs static validation (`validateAndBuild`). If passed, the run completes; if attempts are exhausted, the last-known-good version is preserved and the run fails cleanly.

### 5.5 Version Diff Engine & Rollback Mechanism

- **Location**: `src/modules/versioning/diff-engine.ts`.
- **Diff Computation**:
  - Compares `oldFiles` vs `newFiles` using `Diff.structuredPatch`.
  - Calculates line-by-line additions, deletions, and line hunks with standard `+` and `-` annotations.
- **Rollback Operation (`restoreVersion`)**:
  - Does not overwrite history.
  - Copies the target version's file tree and commits a new version snapshot with an incremented version number (`v(N+1)`), marking it active.

### 5.6 Project Orchestrator & Lifecycle Invariants

- **Location**: `src/server/jobs/orchestrator.ts` (`ProjectOrchestrator`).
- **Invariants**:
  - *Cooperative Cancellation*: Before each lifecycle transition, calls `isCancelled(runId)`. If cancelled, halts immediately and avoids writing files or advancing version state.
  - *Atomic Version Publishing*: Uses `publishVersionIfActive(runId, projectId, version, files)`. In PostgreSQL, this executes inside a single database transaction (`$transaction`). If the run was cancelled while generation was executing, the transaction safely aborts without leaving orphaned active versions.
  - *Monotonic Sequence Numbers*: SSE events carry strictly incrementing sequence numbers (`1`, `2`, `10`, `20`, `30`, `40`, `50`, `60`) for gapless client rendering.

---

## 6. Database & Data Model Documentation

### 6.1 Storage Architecture: Dual Adapter Pattern

Shipshape features a dual-layer data persistence architecture:
1. **Production Mode (`prismaAdapter`)**: Active when `DATABASE_URL` is set. Connects to Neon PostgreSQL using `@prisma/adapter-pg` with connection pooling. If `NODE_ENV === 'production'` and `DATABASE_URL` is unset, the system deliberately throws an error rather than risking data loss.
2. **Development Fallback Mode (`jsonAdapter`)**: Active in local development when `DATABASE_URL` is unset. Persists records to `.shipshape-data/store.json` using atomic temporary file renaming (`fs.rename`).

### 6.2 Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ projects : "owns"
    projects ||--o{ project_specifications : "has"
    projects ||--o{ project_versions : "versions"
    projects ||--o{ project_files : "contains"
    projects ||--o{ generation_runs : "runs"
    projects ||--o{ sandbox_sessions : "has"
    projects ||--o{ preview_sessions : "previews"
    projects ||--o{ project_assets : "assets"
    projects ||--o{ usage_records : "tracks"
    projects ||--o{ audit_events : "logs"

    generation_runs ||--o{ generation_events : "emits"
    generation_runs ||--o{ build_results : "produces"
    generation_runs ||--o{ build_logs : "records"
    generation_runs ||--o{ usage_records : "incurs"

    project_versions ||--o{ project_files : "snapshots"
    project_versions ||--o{ build_results : "validates"

    sandbox_sessions ||--o{ preview_sessions : "serves"

    users {
        string id PK
        string email UK
        string name
        string avatarUrl
        string clerkId UK
        datetime createdAt
        datetime updatedAt
    }

    projects {
        string id PK
        string ownerUserId FK
        string name
        string description
        string status
        string activeVersionId
        datetime createdAt
        datetime updatedAt
        datetime archivedAt
    }

    project_specifications {
        string id PK
        string projectId FK
        int versionNumber
        text specificationJson
        text planJson
        string schemaVersion
        datetime createdAt
    }

    project_versions {
        string id PK
        string projectId FK
        string parentVersionId
        int versionNumber
        text sourceManifest
        string snapshotReference
        string changeSummary
        string validationStatus
        datetime createdAt
    }

    project_files {
        string id PK
        string projectId FK
        string versionId FK
        string path
        text content
        int sizeBytes
        string mimeType
        string responsibility
        string fileType
        boolean isNew
        boolean isModified
        datetime updatedAt
    }

    generation_runs {
        string id PK
        string projectId FK
        string baseVersionId
        string resultVersionId
        string runType
        string status
        string modelProvider
        string modelIdentifier
        int attemptCount
        text prompt
        datetime startedAt
        datetime finishedAt
        string errorCode
        string errorMessage
        text usageMetadata
    }

    generation_events {
        string id PK
        string generationRunId FK
        int sequenceNumber
        string eventType
        text message
        text metadata
        datetime createdAt
    }

    sandbox_sessions {
        string id PK
        string projectId FK
        string providerKey
        string externalSandboxId
        string status
        int port
        string hostUrl
        string workspaceDir
        int pid
        datetime createdAt
        datetime lastActivityAt
        datetime expiresAt
        datetime terminatedAt
        string errorCode
    }

    preview_sessions {
        string id PK
        string projectId FK
        string sandboxSessionId FK
        string previewUrl
        string isolationOrigin
        string status
        datetime createdAt
        datetime expiresAt
    }

    build_results {
        string id PK
        string generationRunId FK
        string projectVersionId FK
        string checkType
        string status
        int exitCode
        int durationMs
        string logReference
        text errorsJson
        datetime createdAt
    }

    build_logs {
        string id PK
        string generationRunId FK
        string streamType
        text content
        datetime timestamp
    }

    audit_events {
        string id PK
        string userId
        string projectId FK
        string action
        text metadata
        string ipAddress
        datetime createdAt
    }

    idempotency_records {
        string id PK
        string idempotencyKey UK
        text responsePayload
        string status
        datetime createdAt
    }
```

### 6.3 Prisma Models & Schema Reference

1. **`User`** (`users` table): User accounts. Contains `id` (UUID), `email` (unique), `name`, `avatarUrl`, and `clerkId` (unique). Cascades deletions to projects.
2. **`Project`** (`projects` table): Central application container. Fields: `id`, `ownerUserId`, `name`, `description`, `status` (`draft`, `planning`, `generating`, `ready`, `building`, `running`, `error`, `archived`), `activeVersionId`, timestamps, and `archivedAt`. Indexed on `ownerUserId`.
3. **`ProjectSpecification`** (`project_specifications` table): Structured JSON blueprint. Fields: `specificationJson`, nullable `planJson`, `versionNumber`, `schemaVersion`.
4. **`ProjectVersion`** (`project_versions` table): Immutable historical snapshots. Fields: `versionNumber`, `sourceManifest` (array of file paths), `validationStatus` (`pending`, `passed`, `failed`), and `changeSummary`.
5. **`ProjectFile`** (`project_files` table): File content storage. Fields: `path`, `content`, `sizeBytes`, `mimeType`, `responsibility`, `fileType`, flags `isNew` / `isModified`. Unique compound constraint on `[projectId, versionId, path]`.
6. **`GenerationRun`** (`generation_runs` table): Job tracking record. Fields: `runType` (`generation`, `modification`, `repair`), `status` (`queued`, `planning`, `generating`, `validating`, `installing`, `building`, `starting`, `preview_ready`, `repairing`, `completed`, `failed`, `cancelled`), `modelProvider`, `modelIdentifier`, `attemptCount`, and `usageMetadata`.
7. **`GenerationEvent`** (`generation_events` table): Fine-grained progress events. Indexed on `[generationRunId, sequenceNumber]`.
8. **`SandboxSession`** (`sandbox_sessions` table): Execution container metadata. Fields: `port`, `hostUrl`, `workspaceDir`, `pid`, `expiresAt`.
9. **`BuildResult`** & **`BuildLog`**: Records check outputs (`typecheck`, `lint`, `build`) and monospaced log lines (`stdout`, `stderr`, `system`).
10. **`AuditEvent`** (`audit_events` table): Immutable compliance log tracking actions (`project_created`, `version_restored`, `code_exported`, `runtime_started`, `runtime_stopped`).
11. **`IdempotencyRecord`** (`idempotency_records` table): Caches completed operation responses keyed by `idempotencyKey`.

---

## 7. End-to-End Data Flow & Execution Traces

### 7.1 Workflow 1: Initial Generation & Verification

```mermaid
sequenceDiagram
    autonumber
    actor User as Product Builder
    participant UI as Workspace View (Next.js)
    participant API as /api/v1/projects/:id/generate
    participant Orch as ProjectOrchestrator
    participant Gen as Code Generator
    participant San as SandboxManager
    participant Rep as BoundedRepairLoop
    participant DB as Neon DB (Prisma)
    participant SSE as /api/v1/generation-runs/:id/events

    User->>UI: Types prompt & clicks "Generate Application"
    UI->>API: POST { prompt: "..." }
    API->>DB: Check for active runs & create queued GenerationRun
    API->>Orch: runFullGeneration(runId, projectId, plan)
    
    par SSE Stream Initialized
        UI->>SSE: GET /api/v1/generation-runs/:id/events
        SSE-->>UI: Connected
    and Execution Pipeline
        Orch->>DB: updateGenerationRun(status: "planning")
        Orch->>SSE: Emit step_started (Planning)
        Orch->>Gen: generateProjectFiles(plan, spec)
        Gen-->>Orch: Array of 16 GeneratedFiles
        Orch->>DB: updateGenerationRun(status: "generating")
        Orch->>SSE: Emit file_generated events

        Orch->>San: validateAndBuild(projectId, runId, files)
        San->>San: Check manifest & JSON syntax
        alt Validation Fails
            San-->>Orch: { passed: false, errors }
            Orch->>Rep: attemptRepair(projectId, runId, files, errors)
            Rep->>Rep: Patch JSON / synthesize missing stubs
            Rep-->>Orch: { success: true, fixedFiles }
        else Validation Passes
            San-->>Orch: { passed: true }
        end

        Orch->>San: startSandbox(projectId, finalFiles)
        San->>San: Write files to OS temp directory
        San->>DB: saveSandboxSession(status: "running")

        Orch->>DB: publishVersionIfActive(newVersion, finalFiles)
        Note over DB: Atomic transaction: commits v1, updates activeVersionId, sets run completed
        Orch->>SSE: Emit preview_ready & done
    end

    API-->>UI: 200 OK { success: true, versionId: "..." }
    UI->>UI: Refreshes file tree & loads iframe preview
```

### 7.2 Workflow 2: Iterative Natural-Language Modification

1. **User Action**: Enters modification prompt (e.g. *"Add high-contrast dark theme and export button"*).
2. **Frontend Dispatch**: Issues `POST /api/v1/projects/:projectId/modify` with payload `{ instruction, baseVersionId: activeVersionId }`.
3. **Backend Processing**:
   - `modifyProjectFiles(baseFiles, instruction)` identifies matching targets (`src/app/globals.css`, `src/app/explore/page.tsx`, or `src/app/page.tsx`).
   - Applies targeted code patches and computes a structured change summary.
4. **Validation**: Static validation checks the modified files.
5. **Atomic Commit**: A new `ProjectVersion` (`v2`) is saved with `parentVersionId: v1`.
6. **UI Synchronization**: Workspace updates diff panel, reloads file tree, and triggers iframe refresh.

---

## 8. Edge Cases, Failure Modes & Error Handling Matrix

| Scenario / Edge Case | Component Involved | Handling Strategy | Confirmed Implementation Status |
|---|---|---|---|
| **Path Traversal Attack (`../../etc/passwd`)** | `src/server/security/safe-paths.ts` | Rejects null bytes, Windows drive letters, relative parent hops, and system folders (`.git`, `node_modules`, `.env`). Throws safe error. | **Handled Correctly** (100% verified by `safe-paths.test.ts`) |
| **Malformed / Invalid JSON in API Request** | Route Handlers & Zod | Intercepts JSON parse failures via `.catch(() => null)`. Passes through Zod schemas; returns `400 Bad Request` with structured error details. | **Handled Correctly** (Verified by `api-schemas.test.ts`) |
| **Concurrent Generation Request** | `generate/route.ts` & `modify/route.ts` | Checks `db.getLatestGenerationRun`. If an active run exists under 120s old, returns `409 Conflict`. If over 120s old, marks prior run failed with `RUN_TIMEOUT`. | **Handled Correctly** (Tested in `generation-lifecycle-hardening.test.ts`) |
| **User Cancels Running Generation** | `orchestrator.ts` & `cancel/route.ts` | Updates run status to `cancelled`. Orchestrator checks `isCancelled(runId)` at each step; publication transaction aborts if status is not active. | **Handled Correctly** (Tested in `generation-lifecycle-hardening.test.ts`) |
| **IDOR Cross-Tenant Access Attempt** | `src/lib/auth/session.ts` | `getOwnedProject` verifies `project.ownerUserId === user.id`. Returns `null` on mismatch, producing an unambiguous `404 Not Found`. | **Handled Correctly** (Verified by `api-authorization.test.ts`) |
| **Unauthenticated Request** | `requireAuth()` | Throws `AuthSessionError("Authentication required", 401)`. Returns HTTP 401 JSON. | **Handled Correctly** |
| **Serverless Execution Timeout (60s)** | API Route Handlers | Exported `maxDuration = 60` configures execution limits. Generator and static validation complete in < 2 seconds, well under the window. | **Handled Correctly** |
| **Gemini AI Rate Limiting (429 / 503)** | `gemini-provider.ts` | Retries at most once with exponential backoff and jitter. If quota is exceeded, falls back to deterministic domain catalog. | **Handled Correctly** (Verified by `gemini-provider.test.ts`) |
| **Invalid JSON Syntax in Generated Code** | `repair-loop.ts` | Bounded repair loop detects JSON parse errors, applies regex fixes, and validates before committing. Max 3 attempts. | **Handled Correctly** (Verified by `repair-loop.test.ts`) |
| **Serverless Read-Only Filesystem Conflict** | `sandbox-manager.ts` | Writes workspace files to OS temporary directory (`os.tmpdir()`). Logs warning on failure but does not break export or preview. | **Handled Correctly** |
| **Production Missing DATABASE_URL** | `src/lib/db/index.ts` | Throws explicit error in production rather than silently falling back to local JSON store. | **Handled Correctly** (Verified by `api-authorization.test.ts`) |

---

## 9. Authentication, Security & Environment Configuration

### 9.1 Authentication & Session Management
- **Provider**: Clerk (`@clerk/nextjs`).
- **Middleware Boundary**: Handled via `src/proxy.ts` using `clerkMiddleware()`. Matches all route handlers while excluding Next.js static bundles and media files.
- **Identity Linking & JIT Account Provisioning**:
  - `requireAuth()` in `src/lib/auth/session.ts` checks the caller's Clerk user ID.
  - If no local account exists, it calls `currentUser()` to verify that the primary email address has been verified (`status === 'verified'`).
  - Creates a row in the `users` table linked by `clerkId`. Does not link accounts by email alone, preventing account takeover vulnerabilities.

### 9.2 Security Hardening Controls
1. **Path Containment (`validateSafePath`)**: Blocks directory traversal by normalizing paths with POSIX rules and checking against forbidden prefixes (`.git/`, `node_modules/`, `.env`, `.next/`, `tmp/`).
2. **Secret Scrubbing Engine (`scrubSecrets`)**: Automatically redacts Postgres connection strings (`postgres://user:[REDACTED]@...`), API keys (`AIzaSy...`, `sk-...`), GitHub tokens (`ghp_...`), and environment variables matching `SECRET="..."` before exporting archives or writing terminal logs.
3. **Iframe Isolation**: Sandbox previews are delivered with `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

### 9.3 Environment Variables Inventory

| Variable Name | Required | Default / Fallback | Description |
|---|---|---|---|
| `NODE_ENV` | Optional | `development` | Runtime mode (`development`, `production`, `test`). |
| `NEXT_PUBLIC_APP_NAME` | Optional | `Shipshape` | Application name displayed in the UI header and meta tags. |
| `NEXT_PUBLIC_APP_URL` | Optional | `http://localhost:3000` | Canonical public origin URL. |
| `DATABASE_URL` | Required in Prod | `undefined` (falls back to JSON in dev) | Pooled PostgreSQL connection string (Neon serverless pooler). |
| `DIRECT_URL` | Optional | `undefined` | Direct PostgreSQL connection string for Prisma migrations. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required | `pk_test_...` | Clerk client-side publishable key for browser authentication. |
| `CLERK_SECRET_KEY` | Required | `sk_test_...` | Clerk server-side secret key for token verification. |
| `GEMINI_API_KEY` | Optional | `undefined` | Google AI Studio API key. When omitted, deterministic generator is used. |
| `GEMINI_MODEL` | Optional | `gemini-3.5-flash` | Primary Gemini model identifier for code synthesis. |
| `SANDBOX_DIR` | Optional | `os.tmpdir()/shipshape-sandboxes` | Base directory on the host filesystem for temporary sandbox workspaces. |
| `SANDBOX_EXECUTION_TIMEOUT_MS` | Optional | `30000` | Execution timeout threshold for sandbox validation runs. |
| `SANDBOX_MAX_MEMORY_MB` | Optional | `512` | Memory ceiling allocated to child processes. |
| `SANDBOX_PORT_START` | Optional | `3100` | Port range baseline for preview routing. |

---

## 10. External Integrations & Service Providers

1. **Google Gemini API**:
   - Provider: Google Cloud Generative Language API.
   - Files: `src/modules/ai/gemini-provider.ts`.
   - Purpose: Multi-file project code generation from natural-language plans.
   - Resilience: Structured JSON schema enforcement, request timeout (12s), retry with exponential backoff and jitter, and transparent fallback to local deterministic generation.
2. **Clerk Authentication**:
   - Provider: Clerk Inc.
   - Files: `src/proxy.ts`, `src/lib/auth/session.ts`, `src/app/layout.tsx`.
   - Purpose: Authentication, user session management, user profile avatar storage.
3. **Neon Serverless PostgreSQL**:
   - Provider: Neon.
   - Files: `src/lib/db/prisma.ts`, `src/lib/db/prisma-adapter.ts`, `prisma/schema.prisma`.
   - Purpose: Primary persistent relational store with pooled connections via `@prisma/adapter-pg`.

---

## 11. Build, Runtime, Testing & Deployment

### 11.1 Verified Test & Build Results
All test, lint, typecheck, and build commands have been verified on this repository:

```bash
# 1. Run Automated Unit & Integration Tests
npm test
# Result: 12 test files passed, 72 tests passed (Duration: 4.20s)

# 2. Run TypeScript Typecheck
npx tsc --noEmit
# Result: 0 errors (Completed cleanly)

# 3. Run ESLint Code Quality Checks
npm run lint
# Result: Passed without warnings or errors

# 4. Run Next.js Production Build
npm run build
# Result: Compiled successfully in 1182ms via Turbopack (11 static pages, 12 dynamic routes)
```

### 11.2 Local Setup Instructions

```bash
# Clone and enter directory
cd Shipshape

# Install dependencies
npm install

# Setup local environment
cp .env.example .env.local
# (Populate NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY)

# Start local development server
npm run dev
# Server listening at http://localhost:3000
```

### 11.3 Database Setup & Migration Commands

```bash
# Push Prisma schema to Neon PostgreSQL
npx prisma db push

# Run pending migrations
npx prisma migrate deploy

# (Optional) Import local JSON store data into PostgreSQL
node scripts/import-json-to-neon.mjs --apply
```

### 11.4 Deployment Configuration
- **Platform**: Vercel or Node.js Docker container.
- **Node.js Version**: `>= 18.0.0` (v20+ recommended).
- **Serverless Considerations**: Handlers configured with `maxDuration = 60`. In-process generation jobs complete within 2–5 seconds, well within serverless timeouts.

---

## 12. Technical Debt, Gaps & Architectural Recommendations

### 12.1 Implementation Status: Implemented vs Partial vs Inferred

| Feature / Capability | Implementation Status | Evidence / Verification Notes |
|---|---|---|
| **Multi-File Code Generation** | **Fully Implemented** | Both deterministic engine (`generator.ts`) and Gemini API (`gemini-provider.ts`) produce complete Next.js projects. |
| **Path Traversal Security** | **Fully Implemented** | Bounded validation in `safe-paths.ts` rejects null bytes, drive letters, and traversal hops. |
| **Secret Scrubbing on Export** | **Fully Implemented** | Redacts DB URLs, API keys, and sensitive tokens during zip packaging. |
| **Atomic Version Publishing** | **Fully Implemented** | `publishVersionIfActive` uses transactional validation to prevent orphaned versions. |
| **Clerk Authentication & IDOR Checks** | **Fully Implemented** | `requireAuth` and `getOwnedProject` ensure tenant isolation across all endpoints. |
| **Bounded Self-Healing Repair Loop** | **Fully Implemented** | `repair-loop.ts` performs up to 3 repair iterations on JSON syntax and missing manifest stubs. |
| **Interactive In-Browser Preview** | **Fully Implemented** | `preview/[projectId]/[[...path]]/route.ts` renders domain-tailored interactive apps with `localStorage` persistence. |
| **Background Queue / Worker** | **Partially Implemented** | Generation runs execute in-process within the HTTP request using `maxDuration = 60`. While sufficient for the current fast generator, long-running multi-turn AI jobs will require a dedicated worker queue (e.g. BullMQ, Inngest, or QStash). |
| **True Container Sandbox Execution** | **Partially Implemented** | Sandbox files are written to `os.tmpdir()` and static syntax checks are verified. Real Docker/E2B container startup is designed (`sandbox-provider.ts`) but not currently active in production. |
| **Preview Session DB Records** | **Inferred / Stubbed** | The `PreviewSession` model exists in the Prisma schema, but runtime previews currently serve directly via HTTP route matching rather than persisting a separate session row on each request. |

### 12.2 Prioritized Improvement Roadmap

#### Priority 0 (High Architecture Impact)
- **Decouple Generation from HTTP Request Window**: Move `ProjectOrchestrator.runFullGeneration` to a durable background worker (e.g. Inngest, BullMQ with Redis, or AWS SQS) so that generation jobs can run for several minutes without risking HTTP request timeouts.

#### Priority 1 (Security & Runtime Isolation)
- **Activate Containerized Sandbox Provider**: Implement the `SandboxProvider` interface for cloud runners like E2B or Daytona to run `npm install` and real `next dev` child processes with true process isolation.

#### Priority 2 (Developer Experience)
- **Monaco / CodeMirror Interactive Editing**: Upgrade `CodeInspectorPanel.tsx` from a read-only viewer to an in-browser code editor allowing users to directly edit files and save new version snapshots.
- **Git Repository Export**: Expand `export-service.ts` to support pushing directly to a user's GitHub repository via Octokit in addition to downloading `.zip` archives.

#### Priority 3 (Optimization)
- **Tree-sitter AST Syntax Validation**: Upgrade the syntax check in `SandboxManager.validateAndBuild` from basic JSON parsing to full TypeScript AST validation via `@babel/parser` or TypeScript compiler API before publishing.

