# Operations

## Deployment targets

| Target | How |
|---|---|
| **Vercel** | Import the repo. Set the env vars below for Production and Preview. Run `npm run db:migrate` (with `DIRECT_URL`) as a release step before promoting. |
| **Container** (any orchestrator) | `docker build --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_… -t shipshape .` Run the `migrate` target as a one-shot job, then roll out the default `runner` target. |
| **Local, production-like** | `docker compose up --build` (Postgres → migrations job → app). |

The `runner` image is the Next.js standalone server on `node:24-alpine`. It runs as the non-root `node` user and has a built-in `HEALTHCHECK` against `/api/health`.

### Release order

1. Apply migrations (`prisma migrate deploy`). Migrations must be backward compatible with the currently running version: add columns and tables first, and remove them in a later release.
2. Deploy the app.
3. Wait for `/api/ready` to return 200 before shifting traffic.

Rollback means redeploying the previous image or deployment. Because migrations are additive, the previous version stays compatible with the migrated schema.

## Configuration

Validated at boot (`src/lib/env.ts`). In production, an invalid configuration logs `server.invalid_environment` with the failing keys, and the process **exits with code 1** rather than serving errors.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | prod | none | Pooled Postgres URL for the app |
| `DIRECT_URL` | migrations | none | Direct (non-pooled) URL for Prisma Migrate |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | prod (build and run) | none | Clerk frontend key; inlined at build time |
| `CLERK_SECRET_KEY` | prod | none | Clerk backend key |
| `GEMINI_API_KEY` | no | none | Enables the Gemini provider; otherwise the deterministic engine is used |
| `GEMINI_MODEL` | no | `gemini-3.6-flash` | Primary model |
| `SANDBOX_PROVIDER` | no | `local-temp` | `local-temp` or `docker` |
| `LOG_LEVEL` | no | `info` (prod) | `debug`, `info`, `warn`, `error` |
| `RATE_LIMIT_GENERATION_PER_HOUR` | no | 20 | Generate and modify, per user |
| `RATE_LIMIT_PLANNING_PER_HOUR` | no | 60 | Plan creation, per user |
| `RATE_LIMIT_RUNTIME_PER_HOUR` | no | 60 | Runtime starts, per user |
| `RATE_LIMIT_MUTATIONS_PER_MINUTE` | no | 60 | Create, update, duplicate, restore |
| `SHIPSHAPE_ALLOW_FIXTURES` | no | `false` | Allow the fixture provider in production (benchmarks only) |

Empty strings are treated as unset.

## Health probes

| Endpoint | Semantics | Use for |
|---|---|---|
| `GET /api/health` | 200 if the process can serve HTTP. Touches no dependencies. | Liveness. A DB outage must not trigger restarts. |
| `GET /api/ready` | 200 when the DB answers `SELECT 1` within 2s and auth is configured; otherwise 503 with per-check detail. | Readiness and load-balancer routing. |

Serverless Postgres (Neon) may take more than 2s to wake from idle. The first readiness probe after a cold start can return 503 and then recover. Use a probe failure threshold of at least 2.

## Logs

Production emits one JSON object per line:

```json
{"level":"info","time":"…","msg":"request.completed","service":"shipshape","requestId":"…","operation":"projects.generate","method":"POST","path":"/api/v1/projects/…/generate","status":200,"durationMs":8421}
```

Useful queries:

- `msg:"request.failed"`: 5xx responses, with a serialized `err`
- `msg:"generation.finished"`: run outcome, provider, and duration per generation
- `msg:"rate_limit.store_unavailable"`: the limiter is failing open; investigate the DB
- `code:"RATE_LIMITED"` in client-reported envelopes, which pairs with `RateLimit-*` response headers

## Runbook

**A user reports an error.** Ask for the `requestId` from the error toast or response, then search logs for it. The `request.failed` line carries the real error.

**A project is stuck "generating".** Runs older than 120s are reaped to `failed` / `RUN_TIMEOUT` the next time anything reads them. Opening the project triggers this. If runs are timing out routinely, check `generation.finished` durations against the 60s `maxDuration`.

**429s are spiking.** Check whether this is a single user (abuse) or broad (limits too low). Limits are tunable through env vars without a code change. The `rate_limit_buckets` table holds the live counters:

```sql
SELECT key, "windowStart", count FROM rate_limit_buckets WHERE "expiresAt" > now() AT TIME ZONE 'utc' ORDER BY count DESC LIMIT 20;
```

**`/api/ready` is failing.** `checks.database.detail` says whether it's a timeout or an unreachable host. The full error is in `readiness.database_failed` log lines.
