import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/observability/logger';
import { ApiError } from './errors';

/**
 * Fixed-window rate limiting.
 *
 * Serverless deployments run many short-lived instances, so an in-process
 * counter is not a real limit. When PostgreSQL is configured the counter lives
 * in `rate_limit_buckets` and is incremented with a single atomic
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, which is race-free across
 * instances without advisory locks. The in-memory store keeps local
 * development (JSON store, no database) and unit tests dependency-free.
 */

export interface RateLimitPolicy {
  /** Stable identifier used in the bucket key, e.g. `generate`. */
  name: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds when the current window resets. */
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowStart: Date, expiresAt: Date): Promise<number>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, windowStart: Date, expiresAt: Date): Promise<number> {
    const now = Date.now();
    const bucketKey = `${key}@${windowStart.getTime()}`;
    const existing = this.buckets.get(bucketKey);
    const count = (existing?.count ?? 0) + 1;
    this.buckets.set(bucketKey, { count, expiresAt: expiresAt.getTime() });

    if (this.buckets.size > 10_000) {
      for (const [k, bucket] of this.buckets) {
        if (bucket.expiresAt <= now) this.buckets.delete(k);
      }
    }
    return count;
  }
}

export class PostgresRateLimitStore implements RateLimitStore {
  private lastPrune = 0;

  async increment(key: string, windowStart: Date, expiresAt: Date): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "rate_limit_buckets" ("key", "windowStart", "count", "expiresAt")
      VALUES (${key}, ${windowStart}, 1, ${expiresAt})
      ON CONFLICT ("key", "windowStart")
      DO UPDATE SET "count" = "rate_limit_buckets"."count" + 1
      RETURNING "count"
    `;
    this.pruneExpired();
    return Number(rows[0]?.count ?? 1);
  }

  /** Deletes expired windows at most once a minute per instance; never blocks the request. */
  private pruneExpired(): void {
    const now = Date.now();
    if (now - this.lastPrune < 60_000) return;
    this.lastPrune = now;
    // The cutoff is bound as a parameter rather than using NOW(): the column is a
    // `timestamp` (no zone) written in UTC, and comparing it to NOW() would cast
    // through the session time zone, deleting live buckets on non-UTC databases.
    prisma.$executeRaw`DELETE FROM "rate_limit_buckets" WHERE "expiresAt" < ${new Date(now)}`.catch((err: unknown) => {
      logger.warn('rate_limit.prune_failed', { err });
    });
  }
}

let defaultStore: RateLimitStore | null = null;

function getDefaultStore(): RateLimitStore {
  if (!defaultStore) {
    defaultStore = process.env.DATABASE_URL ? new PostgresRateLimitStore() : new MemoryRateLimitStore();
  }
  return defaultStore;
}

export async function consumeRateLimit(
  policy: RateLimitPolicy,
  subject: string,
  store: RateLimitStore = getDefaultStore(),
  now = Date.now()
): Promise<RateLimitResult> {
  const windowStartMs = Math.floor(now / policy.windowMs) * policy.windowMs;
  const resetAt = windowStartMs + policy.windowMs;
  const key = `${policy.name}:${subject}`;

  let count: number;
  try {
    count = await store.increment(key, new Date(windowStartMs), new Date(resetAt));
  } catch (err) {
    // Fail open: a limiter outage must not take the product down with it.
    logger.error('rate_limit.store_unavailable', { policy: policy.name, err });
    return { allowed: true, limit: policy.limit, remaining: policy.limit, resetAt };
  }

  return {
    allowed: count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    resetAt,
  };
}

export function rateLimitHeaders(result: RateLimitResult, now = Date.now()): Record<string, string> {
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.max(0, Math.ceil((result.resetAt - now) / 1000))),
  };
  if (!result.allowed) {
    headers['Retry-After'] = headers['RateLimit-Reset'];
  }
  return headers;
}

/** Consumes one unit and throws a 429 `ApiError` when the subject is over its limit. */
export async function enforceRateLimit(policy: RateLimitPolicy, subject: string): Promise<RateLimitResult> {
  const result = await consumeRateLimit(policy, subject);
  if (!result.allowed) {
    throw new ApiError('RATE_LIMITED', 'Too many requests. Please retry later.', {
      headers: rateLimitHeaders(result),
    });
  }
  return result;
}

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Per-user policies for endpoints that consume AI tokens or sandbox capacity.
 * Limits are overridable per environment without a deploy.
 */
export const RateLimits = {
  get generation(): RateLimitPolicy {
    return { name: 'generation', limit: envInt('RATE_LIMIT_GENERATION_PER_HOUR', 20), windowMs: 3_600_000 };
  },
  get planning(): RateLimitPolicy {
    return { name: 'planning', limit: envInt('RATE_LIMIT_PLANNING_PER_HOUR', 60), windowMs: 3_600_000 };
  },
  get runtime(): RateLimitPolicy {
    return { name: 'runtime', limit: envInt('RATE_LIMIT_RUNTIME_PER_HOUR', 60), windowMs: 3_600_000 };
  },
  get mutation(): RateLimitPolicy {
    return { name: 'mutation', limit: envInt('RATE_LIMIT_MUTATIONS_PER_MINUTE', 60), windowMs: 60_000 };
  },
};
