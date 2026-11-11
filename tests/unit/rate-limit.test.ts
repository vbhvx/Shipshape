import { describe, it, expect } from 'vitest';
import {
  consumeRateLimit,
  MemoryRateLimitStore,
  rateLimitHeaders,
  type RateLimitStore,
} from '@/lib/http/rate-limit';

const policy = { name: 'test', limit: 3, windowMs: 60_000 };

describe('consumeRateLimit', () => {
  it('allows requests up to the limit and rejects the next one', async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000_000_000;

    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await consumeRateLimit(policy, 'user_a', store, now));
    }

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
  });

  it('isolates subjects from one another', async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000_000_000;
    for (let i = 0; i < 3; i++) await consumeRateLimit(policy, 'user_a', store, now);

    expect((await consumeRateLimit(policy, 'user_a', store, now)).allowed).toBe(false);
    expect((await consumeRateLimit(policy, 'user_b', store, now)).allowed).toBe(true);
  });

  it('starts a fresh budget in the next window', async () => {
    const store = new MemoryRateLimitStore();
    const windowStart = 1_000_000_020_000 - (1_000_000_020_000 % policy.windowMs);
    for (let i = 0; i < 4; i++) await consumeRateLimit(policy, 'user_a', store, windowStart);

    const next = await consumeRateLimit(policy, 'user_a', store, windowStart + policy.windowMs);
    expect(next.allowed).toBe(true);
    expect(next.remaining).toBe(2);
  });

  it('reports the window reset time aligned to the window boundary', async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000_012_345;
    const result = await consumeRateLimit(policy, 'user_a', store, now);
    expect(result.resetAt % policy.windowMs).toBe(0);
    expect(result.resetAt).toBeGreaterThan(now);
    expect(result.resetAt - now).toBeLessThanOrEqual(policy.windowMs);
  });

  it('fails open when the backing store is unavailable', async () => {
    const broken: RateLimitStore = {
      increment: async () => {
        throw new Error('database down');
      },
    };
    const result = await consumeRateLimit(policy, 'user_a', broken);
    expect(result.allowed).toBe(true);
  });

  it('counts concurrent requests without losing increments', async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000_000_000;
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeRateLimit(policy, 'burst', store, now))
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });
});

describe('rateLimitHeaders', () => {
  it('emits IETF RateLimit headers and Retry-After only when limited', () => {
    const now = 0;
    const allowed = rateLimitHeaders({ allowed: true, limit: 3, remaining: 2, resetAt: 30_000 }, now);
    expect(allowed).toEqual({ 'RateLimit-Limit': '3', 'RateLimit-Remaining': '2', 'RateLimit-Reset': '30' });

    const limited = rateLimitHeaders({ allowed: false, limit: 3, remaining: 0, resetAt: 30_000 }, now);
    expect(limited['Retry-After']).toBe('30');
  });
});
