# Security

## Threat model

Shipshape is multi-tenant and executes code it did not write (LLM output). The main assets are user projects and the platform's credentials (database, Clerk, model API keys). The main actors are:

- **Another tenant** trying to read or modify someone else's projects
- **Generated code** (possibly steered by a malicious prompt) trying to escape its sandbox or exfiltrate secrets
- **An anonymous client** trying to exhaust paid resources (model tokens, sandbox capacity)

## Controls

### Authentication and tenancy

- Clerk sessions are verified server-side on every API route. Proxy-level checks are never relied on alone.
- A Clerk identity maps to exactly one Shipshape user. Accounts are **never** linked by email alone, and a verified primary email is required to provision one.
- Every resource is resolved through ownership guards (`requireOwnedProject`, `requireOwnedRun`, `requireProjectVersion`). Missing and foreign resources both return the **same 404**, so IDs can't be enumerated across tenants.
- Cross-object references are validated. A `versionId` supplied for restore, diff, export, modify, or `activeVersionId` must belong to the project in the URL.
- IDs are generated from the CSPRNG (`crypto.randomUUID`), not `Math.random()`.

### Input handling

- Every request body goes through a Zod schema. Update schemas are `.strict()`, so server-owned fields (`id`, `projectId`, `versionNumber`, `createdAt`, …) can't be mass-assigned.
- JSON bodies are size-capped (1 MB default, returning 413), and malformed JSON returns 400 instead of an unhandled 500.
- File paths from generated output and from API callers pass `validateSafePath`, which rejects traversal, absolute paths, null bytes, and sensitive filenames.
- Values interpolated into preview HTML are HTML-escaped. JSON embedded in inline scripts is `<`-escaped so `</script>` can't break out.
- Export filenames use RFC 6266 encoding, so project names can't inject headers.

### Abuse and cost control

- Per-user rate limits on generation, planning, runtime starts, and mutations are enforced in Postgres, so they hold across serverless instances (see [ARCHITECTURE.md §4](ARCHITECTURE.md#4-rate-limiting)).
- The Gemini provider accepts a request-budget accountant that caps live model calls per operation. Today it is wired in by the live benchmark harness; wiring it into per-user quotas is on the roadmap.
- One active run per project, with stale-run reaping.
- The fixture provider is disabled in production unless explicitly enabled.

### Sandbox

The Docker provider runs generated apps as a non-root user with `--cap-drop=ALL`, memory, CPU, and PID limits, and ports published only on `127.0.0.1`. Builder credentials are filtered out of the container environment. Outbound network is allowed by default so dependencies can install; pass `networkMode: 'none'` to isolate after install.

### Transport and headers

Set globally in `next.config.ts`: HSTS (2 years, preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, `X-Frame-Options: DENY`, and a CSP covering `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. Preview routes relax framing to `'self'` only. `X-Powered-By` is disabled. API responses are `Cache-Control: no-store`.

### Secrets and logging

- `.env*` files are git-ignored and excluded from the Docker build context.
- Structured logs redact sensitive keys recursively. Client-facing 5xx responses never include internal error messages.
- `scrubSecrets` strips credential-shaped strings from exported project archives.

## Known limitations

These are documented rather than hidden. Each one is on the roadmap.

1. **Preview iframe shares the app origin.** The workspace embeds previews with `sandbox="allow-scripts allow-same-origin"` on the same origin as the app. Today the preview HTML comes from Shipshape's own renderer (escaped, no generated JS executes there). But once arbitrary generated JavaScript runs in that frame, this combination would let it act with the user's session. **Fix:** serve previews from a dedicated origin (e.g. `*.preview.shipshape.app`) with a scoped, short-lived preview token. Then `allow-same-origin` grants nothing.
2. **No global script CSP.** Clerk loads its UI from a per-instance frontend API domain. A nonce-based `script-src` should be rolled out via the proxy, starting in report-only mode.
3. **Active-run check is not atomic.** Two generate requests in the same instant can both start (bounded by the rate limit). Fix: a partial unique index; see ARCHITECTURE.md §3.
4. **Fixed-window rate limiting** allows a burst of up to 2× the limit across a window boundary.

## Reporting

Please report vulnerabilities privately to the maintainer rather than opening a public issue.
