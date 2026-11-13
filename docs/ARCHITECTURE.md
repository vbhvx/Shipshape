# Architecture

This document explains how Shipshape is put together and, more importantly, *why*. Every decision has a cost, and this doc names it.

## 1. System overview

Shipshape turns a natural-language prompt into a versioned, runnable Next.js codebase. A request moves through five subsystems:

1. **Planning** (`src/modules/planning`): turns the prompt into a structured `ProjectSpecification` (routes, entities, features, acceptance criteria) and an editable `ApplicationPlan`. Users can inspect and edit the plan before anything is generated.
2. **Generation** (`src/modules/ai`, `src/modules/generation`): an `IModelProvider` produces files from the plan. There are three implementations behind one interface:
   - `gemini`: structured-JSON output with bounded retries and request budgeting
   - `deterministic`: template synthesis, so the product works with no API key
   - `fixture`: recorded outputs for replayable tests and benchmarks
3. **Validation and repair** (`src/modules/sandbox`, `src/modules/repair`): files are written into an isolated workspace and checked for manifest integrity and syntax. Failures feed a repair loop capped at `MAX_ATTEMPTS = 3`.
4. **Versioning** (`src/modules/versioning`): each successful run publishes an immutable snapshot with its parent pointer. You can diff any two snapshots. A restore creates a *new* snapshot rather than mutating history.
5. **Runtime and verification** (`src/modules/sandbox`, `src/modules/verification`): previews run through a pluggable `SandboxProvider` (`local-temp` or `docker`). Playwright drives scenario-based functional checks against live previews.

The orchestrator (`src/server/jobs/orchestrator.ts`) sequences these stages and persists every transition as a `GenerationEvent`.

## 2. Request path

```
Client ─▶ proxy.ts (Clerk session) ─▶ route handler
                                       └─ apiRoute(operation, handler)
                                            ├─ request id (x-request-id; inbound accepted if well-formed)
                                            ├─ handler: requireAuth → requireOwned* → Zod → rate limit → module call
                                            ├─ error mapping: ApiError | AuthSessionError | ZodError | unknown → envelope
                                            └─ one structured access-log line (status, duration, operation)
```

Route handlers are deliberately thin. They authenticate, authorize, validate, and delegate. They signal failure by **throwing** typed `ApiError`s instead of hand-building responses, which removed about 900 net lines of duplicated try/catch and response plumbing across 21 route files.

**Error envelope** (a stable contract for the UI):

```json
{ "success": false, "error": "Project not found", "code": "NOT_FOUND", "requestId": "c511d34f-…" }
```

Unknown errors return the route's generic message. The internal message goes to the log line that shares the `requestId`, so the client never sees it.

## 2a. Layers and what may import what

```
src/app (routes)  ->  src/server, src/modules, src/lib   (server side)
src/app (pages)   ->  src/hooks, src/components, src/lib/api, src/lib/runs, src/lib/format   (browser side)
src/modules       ->  src/lib (db, observability), other modules
src/lib           ->  nothing product-specific
```

| Layer | Holds | Rule |
|---|---|---|
| `src/app/api/v1/**/route.ts` | HTTP handlers | Authenticate, authorize, validate, call a module, return JSON. No business rules, no SQL. |
| `src/server/jobs` | Orchestrator and run lifecycle | The only code that moves a run between states. |
| `src/modules/*` | Product domains (planning, ai, generation, sandbox, repair, versioning, export, verification) | Know nothing about HTTP; take plain arguments, return plain results. |
| `src/lib/db` | Storage facade | All persistence goes through `db`. `StorageAdapter` is the contract; the Prisma adapter is type-checked against it with `satisfies`, so the two backends cannot drift. |
| `src/lib/http`, `src/lib/auth` | The API's cross-cutting concerns | `apiRoute`, `ApiError`, rate limits, ownership guards. |
| `src/lib/api` | Browser client for `/api/v1` | The only place the UI calls `fetch`. |
| `src/lib/runs/status.ts` | Run status rules | Pure; imported by both the server (reaping, 409s) and the workspace (when to stream, poll or stop). |
| `src/types` | Domain types and request schemas | Shared by both sides; no runtime dependencies beyond Zod. |

## 2b. The UI's data flow and state

- **One client, one error type.** UI code calls `projectsApi.*` and `runsApi.*` (`src/lib/api/projects.ts`). `apiRequest` unwraps the envelope and throws `ApiClientError` for every failure, including network errors (`NETWORK_ERROR`) and non-JSON error pages, so `fetch` never fails silently on a 4xx. `describeError` turns any error into user-facing text, adding the request id for server errors so a report can be matched to its log line.
- **State lives where it is rendered.** There is no global store, and none is needed: the projects and applications pages share `useProjectList`; the workspace owns its run, versions and files in component state, because nothing outside it reads them. The server is the source of truth. Mutations call the API first and update local state only on success.
- **Load states are explicit:** `loading`, `ready`, `signed-out` (a 401 is not an error, it is a reason to offer sign-in) and `error` (shown with `ErrorState` and a retry).
- **Run progress** streams over SSE with a 1.5 s polling fallback; both stop on `isTerminalStatus`, and an abandoned run is detected with the server's own `RUN_STALE_AFTER_MS`. A run's end is handled exactly once (`finishRun`, keyed by run id), whichever channel reports it first. While a generate/modify request is open the page holds a provisional run that is never polled or streamed: the server runs the whole job inside that request, so live progress is only visible when resuming a run (`?runId`), until generation moves to a background worker.
- **The chat reply states the run's real outcome** (published, failed with its reason, cancelled), and says it is still finishing when the UI lock was released before the server reported an end.
- **Error boundaries.** `src/app/error.tsx` catches rendering errors per route, `global-error.tsx` catches a failing root layout, `not-found.tsx` serves unknown paths. Server errors show only their `digest`, which `instrumentation.ts` logs with the full error.

## 2c. Conventions

- Files: components in `PascalCase.tsx`, everything else `kebab-case.ts`; hooks `useX.ts`.
- API: resources under `/api/v1/<resource>/<id>/<action>`; every handler is `apiRoute('<resource>.<action>', ...)`, which names its log lines.
- Errors: route handlers throw `ApiError` helpers (`notFound`, `conflict`, `validationFailed`...); the UI throws and catches `ApiClientError`; server code logs through `logger`, never `console`.
- IDs: `newId('<prefix>')` from the CSPRNG.

## 3. The run and project state machines

Both machines are defined once, in `src/lib/runs/status.ts`, and **enforced by the storage adapters**: a status write applies only from a legal predecessor (in Postgres, one atomic conditional `UPDATE ... WHERE status IN/NOT IN (...)`), and a refused write is logged as `db.run_transition_rejected` or `db.project_transition_rejected` instead of silently applied.

**Runs**

```
full generation: queued → planning → generating → validating → building ─┬─▶ starting → preview_ready ─▶ completed
modification:    queued → generating → validating → building ─────────────┤  (publishes from here)
                                                    repairing ◀───────────┘  repairing → validating | building | starting
any in-progress state ──▶ completed (only through the publish transaction) | failed | cancelled
completed, failed, cancelled are final: nothing changes them, so a late step write cannot revive a cancelled run.
```

**Projects** (archiving is `archivedAt`, set by DELETE; it is not a status, and clients cannot set `status` through PATCH)

| Status | Meaning | Set by |
|---|---|---|
| `draft` | no version yet | create; a cancelled first run |
| `planning` | a plan was written | plan route (409 while a run is active) |
| `generating` | a run is in progress | generate and modify routes |
| `running` | the latest run published, or the preview runtime was started | publish transaction; runtime start |
| `ready` | a version exists and nothing runs | restore (409 while a run is active); runtime stop; a cancelled run on a project with versions |
| `error` | the latest run failed | a failed run, including exhausted repairs and timeouts |

When a run ends, **however it ends**, `settleProjectAfterRun` moves the project out of `generating` (`projectStatusAfterRun` maps completed → `running`, failed → `error`, cancelled → `ready` or `draft`). The orchestrator calls it on every exit, the cancel route calls it because the orchestrator may be on another instance or gone, and the stale-run reaper calls it after a timeout. It acts only when the run is the project's latest, so an old run can never overwrite the status a newer one owns. Rows holding a status from before these rules (`building`, `archived`) may move to any valid status, so old data can always be repaired.

The hard problems are concurrency problems:

| Problem | Decision | Trade-off |
|---|---|---|
| A cancel and a completion race | `publishVersionIfActive` runs in **one transaction**: `UPDATE generation_runs SET status='completed' WHERE id=? AND status NOT IN (terminal)`. If that updates 0 rows, the version is not published. | Requires a transactional store. The JSON dev adapter emulates it single-process. |
| Cancel arrives at a different instance | The cancel route writes `cancelled` to the database. The executing instance polls its run row every 500ms and calls `AbortController.abort()` to stop in-flight model requests. | Up to ~500ms of cancellation latency plus a cheap indexed read per tick. Push (LISTEN/NOTIFY) was rejected because pooled serverless connections make long-lived listeners unreliable. |
| An instance dies mid-run | Readers (`GET run`, the SSE stream, new generate/modify requests) **reap** non-terminal runs older than `RUN_STALE_AFTER_MS` (120s) as `RUN_TIMEOUT`. | The threshold must exceed `maxDuration` (60s) so a live run is never reaped. That's enforced by convention and documented in `run-lifecycle.ts`. |
| Two concurrent generate requests | `assertNoActiveRun` returns 409 if a live run exists. | Check-then-insert is not atomic. Two requests landing in the same millisecond can both pass. The proper fix is a partial unique index on `(projectId) WHERE status NOT IN (terminal)` (see Roadmap). |

### Why runs execute inside the request

A serverless function may be frozen the moment its response is sent, so "respond 202, keep working" silently strands runs. Shipshape keeps the work inside the request (bounded by `maxDuration = 60`) so every run reaches a durable terminal state. The cost is a hard ceiling on run duration. The documented path past it is a durable queue/workflow worker (see Roadmap). The rest of the system is already shaped for that: progress is read from the database, never from process memory.

### Why SSE polls the database

The SSE endpoint polls persisted events instead of subscribing to an in-process emitter, so a client can be connected to any instance. Polling is sequential, so a slow query can never stack concurrent queries. Status frames are sent only when the status changes, and comment heartbeats every 15s keep idle proxies from cutting the stream.

## 4. Rate limiting

Expensive endpoints (generate, modify, plan, runtime start) and mutations are rate-limited per user:

```sql
INSERT INTO rate_limit_buckets (key, "windowStart", count, "expiresAt") VALUES ($1, $2, 1, $3)
ON CONFLICT (key, "windowStart") DO UPDATE SET count = rate_limit_buckets.count + 1
RETURNING count;
```

- **Why Postgres and not Redis?** Postgres is already a hard dependency, and a single-statement upsert is atomic under concurrency. One less moving part is worth more than the sub-millisecond latency Redis would add at this scale.
- **Why a fixed window?** It's simple and cheap. A client can burst up to 2× the limit across a window boundary, which is acceptable for cost control. A sliding-window log would remove that at the cost of more rows.
- **Why fail open?** Rate limiting protects cost. It must not become an availability dependency, so a store error logs at `error` and lets the request through.
- **Quota fairness.** The limit is consumed only after validation and the active-run check pass, so rejected requests don't burn a user's budget.
- **A bug caught by testing against real Postgres.** The first version pruned with `WHERE "expiresAt" < NOW()`. The column is `timestamp` (no zone) written in UTC, while `NOW()` is `timestamptz`. On a server whose zone is ahead of UTC, live buckets compared as expired and were deleted, which silently reset the limit. The cutoff is now a bound parameter, and CI runs Postgres in `Asia/Kolkata` to keep this covered.

## 5. Data model

PostgreSQL via Prisma 7 with the `pg` driver adapter. Core aggregates:

- `User` (keyed by Clerk ID; never linked by email alone)
- `Project` → `ProjectSpecification` (versioned) → `ProjectVersion` (immutable, parent-linked) → `ProjectFile`
- `GenerationRun` → `GenerationEvent`, `BuildResult`, `BuildLog`, `UsageRecord`
- `SandboxSession`, `PreviewSession`, `AuditEvent`, `IdempotencyRecord`, `RateLimitBucket`

Migrations live in `prisma/migrations`. CI applies them to an empty database and fails on any drift between `schema.prisma` and the migration history.

**Storage facade.** `src/lib/db/index.ts` exposes one `db` interface backed by Prisma when `DATABASE_URL` is set, or by a JSON file in local development. Production refuses to start without a database, enforced both by the facade and by boot-time env validation.

## 6. Observability

- **Logs.** JSON lines in production (`level`, `time`, `msg`, `service`, `requestId`, `operation`, …). Sensitive keys (`authorization`, `cookie`, `*token*`, `*secret*`, `apiKey`, …) are redacted recursively before serialization.
- **Correlation.** Every API response carries `x-request-id`. Error envelopes include it, so a user-reported error maps to exactly one log line.
- **Unhandled errors.** `instrumentation.ts` → `onRequestError` logs render and route failures with route context.
- **Probes.** `/api/health` (liveness, no dependencies) and `/api/ready` (DB `SELECT 1` with a 2s timeout, plus auth config). See [OPERATIONS.md](OPERATIONS.md).

## 7. Testing strategy

| Layer | What | Runs |
|---|---|---|
| Unit | API wrapper contract, rate-limit semantics, env validation, log redaction, schemas, diff engine, repair loop, providers, path safety | every PR |
| DB integration | Rate limiter atomicity under concurrent burst, prune correctness, against real Postgres in a non-UTC zone | every PR (`TEST_DATABASE_URL`) |
| Pipeline integration | Generation → modification → export lifecycle on the dev store | every PR |
| Sandbox E2E | Generated app → Docker build → live server → Playwright → induced failure → repair → re-verify | weekly / on demand (`REQUIRE_SANDBOX_E2E=1`) |
| Benchmarks | Fixture replay and budgeted live-Gemini evaluations | manual (`npm run benchmark:*`), reports in `docs/reports` |

Environment-dependent suites **skip** when their tooling is missing and **fail** when it's required. A missing Docker daemon never turns CI red, and a broken one never passes silently.

## 8. Roadmap

Ordered by production impact:

1. **Durable execution.** Move `runFullGeneration` / `runModification` onto a queue or workflow worker so runs can outlive one request and retry by step.
2. **Atomic single-active-run.** A partial unique index on `generation_runs(projectId) WHERE status NOT IN ('completed','failed','cancelled')` to close the check-then-insert window.
3. **Preview origin isolation.** Serve generated previews from a separate origin (see [SECURITY.md](SECURITY.md#known-limitations)).
4. **Push-based progress.** Replace SSE polling with a pub/sub fan-out once runs move to workers.
5. **Distributed tracing.** OpenTelemetry spans across the orchestrator stages and model calls.
