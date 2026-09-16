# Shipshape

Shipshape is an authenticated application-building workspace. Users can create projects, generate and modify files from a specification, inspect plans and generation runs, compare and restore versions, export projects, and start/stop a preview runtime.

## Architecture

Built with Next.js 16, React 19, Clerk, Prisma 7/PostgreSQL, Zod, and Tailwind CSS. API routes in `src/app/api/v1` own the project, generation, version, export, and runtime workflows. The preview proxy is implemented under `api/v1/preview`; sandbox controls are configured through environment variables. `prisma/` contains the schema and migrations; `tests/` and `scripts/` contain unit/integration and benchmark tooling.

## Setup

Requires Node.js 20+, PostgreSQL, and Clerk development credentials.

```bash
cd 38_Shipshape
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Set `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` to real local/development values. `SANDBOX_PROVIDER=local-temp` is the default simulation; Docker sandboxing requires an available Docker image and the documented resource settings.

```bash
npm test
npm run lint
npm run build
npm run preflight:gemini
```

The Gemini-related benchmark commands are optional diagnostics, not required for normal local development.
