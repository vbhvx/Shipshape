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

## 3. Generation runs as a state machine

```
queued → planning → generating → validating → building ─┬─▶ starting → preview_ready → completed
                                                        └─▶ repairing ─┘
                any non-terminal state ──▶ failed | cancelled
```

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
