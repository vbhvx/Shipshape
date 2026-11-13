import { describe, it, expect } from 'vitest';
import { parseServerEnv, EnvValidationError } from '@/lib/env';
import { redact } from '@/lib/observability/logger';
import { newId } from '@/lib/ids';
import { isRunStale as isStale, isTerminalStatus as isTerminal, RUN_STALE_AFTER_MS } from '@/lib/runs/status';
import { UpdateSpecificationSchema, type GenerationRun } from '@/types';

describe('parseServerEnv', () => {
  it('accepts a minimal development environment and applies defaults', () => {
    const env = parseServerEnv({ NODE_ENV: 'development' });
    expect(env.SANDBOX_PROVIDER).toBe('local-temp');
  });

  it('requires database and auth configuration in production', () => {
    try {
      parseServerEnv({ NODE_ENV: 'production' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const issues = (err as EnvValidationError).issues.join('\n');
      expect(issues).toContain('DATABASE_URL');
      expect(issues).toContain('CLERK_SECRET_KEY');
    }
  });

  it('rejects malformed values', () => {
    expect(() =>
      parseServerEnv({ NODE_ENV: 'development', SANDBOX_PROVIDER: 'kubernetes' })
    ).toThrow(EnvValidationError);
    expect(() =>
      parseServerEnv({ NODE_ENV: 'development', RATE_LIMIT_GENERATION_PER_HOUR: '-5' })
    ).toThrow(EnvValidationError);
  });
});

describe('logger redaction', () => {
  it('redacts sensitive keys at any depth without mutating the input', () => {
    const input = {
      user: 'u1',
      headers: { authorization: 'Bearer abc', cookie: 'x=1', accept: 'json' },
      nested: [{ apiKey: 'k', value: 1 }],
      CLERK_SECRET_KEY: 'sk_live',
    };
    const output = redact(input) as typeof input;

    expect(output.user).toBe('u1');
    expect(output.headers.authorization).toBe('[REDACTED]');
    expect(output.headers.cookie).toBe('[REDACTED]');
    expect(output.headers.accept).toBe('json');
    expect(output.nested[0].apiKey).toBe('[REDACTED]');
    expect(output.CLERK_SECRET_KEY).toBe('[REDACTED]');
    expect(input.headers.authorization).toBe('Bearer abc');
  });

  it('serializes errors instead of emitting empty objects', () => {
    const output = redact({ err: new Error('boom') }) as { err: { message: string; name: string } };
    expect(output.err).toMatchObject({ name: 'Error', message: 'boom' });
  });
});

describe('newId', () => {
  it('produces prefixed, unique identifiers', () => {
    const ids = new Set(Array.from({ length: 1_000 }, () => newId('proj')));
    expect(ids.size).toBe(1_000);
    for (const id of ids) expect(id).toMatch(/^proj_[0-9a-z]+$/);
  });
});

describe('run lifecycle', () => {
  const run = (status: GenerationRun['status'], ageMs: number): GenerationRun => ({
    id: 'run_1',
    projectId: 'proj_1',
    runType: 'generation',
    status,
    modelProvider: 'deterministic',
    modelIdentifier: 'deterministic-engine-v1',
    attemptCount: 1,
    startedAt: new Date(Date.now() - ageMs).toISOString(),
  });

  it('classifies terminal statuses', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('starting')).toBe(false);
  });

  it('treats only old, non-terminal runs as stale', () => {
    expect(isStale(run('generating', RUN_STALE_AFTER_MS + 1_000))).toBe(true);
    expect(isStale(run('generating', 1_000))).toBe(false);
    expect(isStale(run('completed', RUN_STALE_AFTER_MS * 10))).toBe(false);
  });
});

describe('UpdateSpecificationSchema', () => {
  it('accepts editable content fields', () => {
    expect(UpdateSpecificationSchema.safeParse({ name: 'CRM', acceptanceCriteria: ['loads'] }).success).toBe(true);
  });

  it('rejects attempts to overwrite server-owned fields', () => {
    for (const field of ['id', 'projectId', 'versionNumber', 'createdAt']) {
      expect(UpdateSpecificationSchema.safeParse({ [field]: 'x' }).success).toBe(false);
    }
  });
});

describe('parseServerEnv empty values', () => {
  it('treats empty strings as unset rather than malformed', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'development', DATABASE_URL: '' })).not.toThrow();
    expect(() => parseServerEnv({ NODE_ENV: 'production', DATABASE_URL: '' })).toThrow(/DATABASE_URL is required/);
  });
});
