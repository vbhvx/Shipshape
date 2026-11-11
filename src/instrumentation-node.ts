import { parseServerEnv, type ServerEnv } from '@/lib/env';
import { logger } from '@/lib/observability/logger';

/** Node.js-only boot sequence, loaded from `instrumentation.ts` when NEXT_RUNTIME is `nodejs`. */
export function bootNodeServer(): void {
  // Runtime secrets are not required to compile; validate only when serving.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  let env: ServerEnv;
  try {
    env = parseServerEnv();
  } catch (err) {
    // Fail fast: Next.js logs and continues when register() throws, which would leave a
    // misconfigured instance answering 500s. In production, exit so the orchestrator
    // marks the deploy unhealthy instead of routing traffic to it.
    logger.error('server.invalid_environment', { err });
    if (process.env.NODE_ENV === 'production') process.exit(1);
    throw err;
  }

  logger.info('server.started', {
    nodeEnv: env.NODE_ENV,
    storage: env.DATABASE_URL ? 'postgres' : 'json-file',
    sandboxProvider: env.SANDBOX_PROVIDER,
    aiProvider: env.GEMINI_API_KEY ? 'gemini' : 'deterministic',
  });
}
