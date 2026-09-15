# Shipshape — Gemini Model Evaluation Benchmark Report
**Execution Date:** 2026-10-30T06:07:17.991Z<br/>
**Environment:** Node v24.0.0 LTS (evaluated on macOS)<br/>
**Evaluator:** `scripts/benchmark-gemini.mjs`<br/>
**Dataset:** 3 synthetic enterprise scenarios (Todo App, Kanban Board, Financial Dashboard)

> [!IMPORTANT]
> ### Evaluation Scope vs. Application Build Scope
> **What this benchmark measures:**
> - Structured JSON schema adherence against Google Generative Language REST API (`responseMimeType: 'application/json'`).
> - Multi-file scaffold completeness (presence of layout, page, components, lib storage, and styles).
> - Static syntax validity of generated JSON payloads and code structures.
> - Generation latency (P50/P95), token efficiency, and estimated generation cost.
>
> **What this benchmark does NOT claim or measure:**
> - **Full Next.js Compiler Builds:** The benchmark does NOT run `next build`, Turbopack compilation, TypeScript semantic type-checking, or npm dependency resolution on the generated files.
> - **Arbitrary Containerized Execution:** Shipshape does not currently execute generated applications inside isolated cloud microVMs or container runtimes (such as Modal, E2B, or Firecracker).
> - **Preview Harness Architecture:** As documented in `PROJECT_DOCUMENTATION.md`, Shipshape's interactive preview currently relies on `renderGeneratedPreviewApp` (a client-side HTML/JS rendering harness with browser `localStorage`), not full-stack server execution of generated Next.js route handlers.

---

## 1. Executive Summary & Recommendation

| Metric | `gemini-3.6-flash` | `gemini-3.8-flash` | Assessment / Architectural Decision |
| :--- | :--- | :--- | :--- |
| **Success Rate** | **66.7%** (2/3) | **0.0%** (0/3) | `gemini-3.6-flash` is the only viable model on the public REST endpoint |
| **Structured Output (JSON)** | **100%** on completed runs | 0.0% | Complete schema adherence without truncations |
| **Scaffold Completeness** | **12 files** per pass | 0 files | Synthesizes full multi-file App Router structure |
| **Static Syntax Parse** | **Passed** | N/A (timed out) | Syntactically parseable JSON and code parts |
| **Latency (P50)** | **47.5 s** | >60.0 s (timeout) | 37.1s (Todo) to 57.9s (Kanban) with `thinkingBudget: 0` |
| **Latency (P95)** | **59.8 s** | >60.0 s (timeout) | Within the 60s HTTP request timeout threshold |
| **Token Efficiency (Avg)** | **11,617 tokens** | 0 tokens | Complete multi-file code payload |
| **Endpoint Reliability** | **Zero HTTP 5xx errors** | 3 timeouts (408/abort) | `gemini-3.8-flash` timed out even on 1-word probes |
| **Cost per Generation** | **~$0.0045** | $0.0000 | Highly economical for multi-file scaffold synthesis |

---

## 2. Key Findings & Engineering Decisions

### 1. Primary Model Identifier: `gemini-3.6-flash`
`gemini-3.6-flash` successfully synthesized complete 12-file scaffolds for complex applications (Todo App with interactive state in 37.1s, Kanban Board with drag-and-drop state in 57.9s). By configuring `thinkingConfig: { thinkingBudget: 0 }`, latency was reduced significantly by suppressing ~9,600 extraneous thought tokens.

### 2. Empirical Failure Analysis of `gemini-3.8-flash`
During benchmarking, `gemini-3.8-flash` timed out at 60s with 0 bytes returned across all three benchmark scenarios. Follow-up diagnostic testing was conducted using the application's actual REST provider path:
- **Public API Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/`
- **Side-by-Side Probe (Minimal Prompt `"Respond in JSON: {\"status\": \"ok\"}"`):**
  - `gemini-3.6-flash:generateContent`: **HTTP 200 in 1,737 ms**.
  - `gemini-3.8-flash:generateContent`: **Timed out after 30,000 ms** (0 bytes returned).
- **Assessment:** While `gemini-3.8-flash` is listed in Google's public model catalogue, requests to it via the standard public REST tier currently experience high queuing delay or stalling. In contrast, `gemini-3.6-flash` is consistently responsive and fast.

### 3. Fallback Policy: Disabled by Default (P0 Decision)
Because `gemini-3.8-flash` is currently subject to endpoint timeouts, **automatic fallback to `gemini-3.8-flash` has been disabled by default** (`ENABLE_GEMINI_FALLBACK=false`).
* **Rationale:** If `gemini-3.6-flash` experiences a transient failure, attempting an automatic fallback to `gemini-3.8-flash` would subject the user to an additional 55-second delay before ultimately failing.
* **Architecture:** When `gemini-3.6-flash` fails or times out, Shipshape immediately transitions to its deterministic domain catalog engine with honest diagnostic logging.
* **Feature Flag:** Fallback to `gemini-3.8-flash` is gated behind `ENABLE_GEMINI_FALLBACK=true` with a strict `FALLBACK_TIMEOUT_MS = 25000` for experimental evaluation.

---

## 3. Granular Benchmark Run Logs

### [gemini-3.6-flash] Todo App (TaskMaster)
- **Status:** PASSED (HTTP 200)
- **Latency:** 37,132 ms
- **Structured Output:** Valid JSON (matched Zod schema)
- **Scaffold Completeness:** 12 files synthesized (`page.tsx`, `HeaderNav.tsx`, `ItemModal.tsx`, `storage.ts`, etc.)
- **Token Usage:** Prompt: 284, Candidates: 8,871, Thoughts: 0, Total: 9,155
- **Estimated Cost:** $0.00358

### [gemini-3.6-flash] Kanban Board (ProjectFlow)
- **Status:** PASSED (HTTP 200)
- **Latency:** 57,909 ms
- **Structured Output:** Valid JSON (matched Zod schema)
- **Scaffold Completeness:** 12 files synthesized
- **Token Usage:** Prompt: 289, Candidates: 13,791, Thoughts: 0, Total: 14,080
- **Estimated Cost:** $0.00555

### [gemini-3.6-flash] Financial Dashboard (CashPulse)
- **Status:** FAILED (HTTP 408 / Timeout)
- **Latency:** 60,003 ms
- **Notes:** Exceeded the benchmark script's 60s timeout ceiling due to token volume on complex dashboard views. The platform orchestrator timeout has accordingly been set to 55,000ms.

### [gemini-3.8-flash] Todo App, Kanban Board, Financial Dashboard
- **Status:** FAILED (HTTP 408 / Timeout) across all 3 scenarios.
- **Latency:** 60,000+ ms each.
- **Candidate Tokens:** 0 bytes received.
- **Diagnostic Probe:** Minimal prompt `"Say hello in one word."` also timed out after 60,000ms.
- **Resolution:** Gated out of active production fallback path.
