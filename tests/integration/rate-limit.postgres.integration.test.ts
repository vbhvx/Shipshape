import { describe, it, expect, beforeAll } from 'vitest';

// Runs only against a disposable database (CI service container or a local
// throwaway instance); it never falls back to DATABASE_URL so it cannot touch a
// real environment. CI runs Postgres in a non-UTC zone on purpose: an earlier
// prune query compared the UTC `timestamp` column against NOW() and deleted
// live buckets whenever the server time zone was ahead of UTC.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('PostgresRateLimitStore against real PostgreSQL', () => {
  let mod: typeof import('@/lib/http/rate-limit');
  let prisma: typeof import('@/lib/db/prisma').prisma;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    mod = await import('@/lib/http/rate-limit');
    ({ prisma } = await import('@/lib/db/prisma'));
  });

  it('admits exactly `limit` requests from a concurrent burst across pooled connections', async () => {
    const store = new mod.PostgresRateLimitStore();
    const policy = { name: 'it_burst', limit: 5, windowMs: 60_000 };
    const subject = `user_${Date.now()}`;

    const results = await Promise.all(
      Array.from({ length: 25 }, () => mod.consumeRateLimit(policy, subject, store))
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(5);

    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT "count" FROM "rate_limit_buckets" WHERE "key" = ${`it_burst:${subject}`}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(25);
  });

  it('pruning removes only expired windows', async () => {
    const key = `it_prune:${Date.now()}`;
    const longAgo = new Date(Date.now() - 3_600_000);
    await prisma.$executeRaw`
      INSERT INTO "rate_limit_buckets" ("key", "windowStart", "count", "expiresAt")
      VALUES (${key}, ${longAgo}, 3, ${new Date(longAgo.getTime() + 60_000)})
    `;

    // A fresh store prunes on its first increment.
    const store = new mod.PostgresRateLimitStore();
    const policy = { name: 'it_prune_live', limit: 10, windowMs: 60_000 };
    await mod.consumeRateLimit(policy, 'subject', store);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const expired = await prisma.$queryRaw<unknown[]>`SELECT 1 FROM "rate_limit_buckets" WHERE "key" = ${key}`;
    const live = await prisma.$queryRaw<unknown[]>`
      SELECT 1 FROM "rate_limit_buckets" WHERE "key" = ${'it_prune_live:subject'}
    `;
    expect(expired).toHaveLength(0);
    expect(live).toHaveLength(1);
  });
});
