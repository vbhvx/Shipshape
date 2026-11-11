import { z } from 'zod';

/**
 * Server environment contract.
 *
 * Validated once at boot from `instrumentation.ts`, so a misconfigured
 * deployment fails its health check immediately instead of on the first
 * request that happens to touch the missing variable.
 */

const optionalInt = (min: number) =>
  z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().int().min(min).optional());

const ServerEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),

    DATABASE_URL: z.string().url().optional(),
    DIRECT_URL: z.string().url().optional(),

    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
    CLERK_SECRET_KEY: z.string().min(1).optional(),

    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).optional(),

    SANDBOX_PROVIDER: z.enum(['local-temp', 'docker']).default('local-temp'),
    SANDBOX_EXECUTION_TIMEOUT_MS: optionalInt(1_000),
    SANDBOX_MAX_MEMORY_MB: optionalInt(64),

    SHIPSHAPE_ALLOW_FIXTURES: z.enum(['true', 'false']).optional(),

    RATE_LIMIT_GENERATION_PER_HOUR: optionalInt(1),
    RATE_LIMIT_PLANNING_PER_HOUR: optionalInt(1),
    RATE_LIMIT_RUNTIME_PER_HOUR: optionalInt(1),
    RATE_LIMIT_MUTATIONS_PER_MINUTE: optionalInt(1),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    const required = ['DATABASE_URL', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'] as const;
    for (const key of required) {
      if (!env[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required in production` });
      }
    }
  });

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid server environment:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

export function parseServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  // Treat empty strings (e.g. unset `${VAR}` interpolation in compose files) as absent.
  const normalized = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === '' ? undefined : value])
  );
  const result = ServerEnvSchema.safeParse(normalized);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    );
  }
  return result.data;
}
