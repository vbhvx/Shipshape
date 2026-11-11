import { connection } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/observability/logger';

type CheckResult = { status: 'pass' | 'fail' | 'skip'; latencyMs?: number; detail?: string };

const CHECK_TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

async function checkDatabase(): Promise<CheckResult> {
  if (!process.env.DATABASE_URL) {
    return process.env.NODE_ENV === 'production'
      ? { status: 'fail', detail: 'DATABASE_URL is not configured' }
      : { status: 'skip', detail: 'local JSON store in use' };
  }

  const startedAt = performance.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
    return { status: 'pass', latencyMs: Math.round(performance.now() - startedAt) };
  } catch (err) {
    logger.error('readiness.database_failed', { err });
    // Connection details stay in the logs; the probe response is unauthenticated.
    return { status: 'fail', latencyMs: Math.round(performance.now() - startedAt), detail: 'database unreachable' };
  }
}

function checkAuth(): CheckResult {
  const configured = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return configured ? { status: 'pass' } : { status: 'fail', detail: 'Clerk keys are not configured' };
}

/**
 * Readiness probe: returns 503 until every hard dependency is reachable, so a
 * load balancer stops routing traffic to an instance that cannot serve it.
 */
export async function GET() {
  await connection();

  const checks = { database: await checkDatabase(), auth: checkAuth() };
  const ready = Object.values(checks).every((check) => check.status !== 'fail');

  return Response.json(
    { status: ready ? 'ready' : 'not_ready', checks },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
