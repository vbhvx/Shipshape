import { db } from '@/lib/db';
import { conflict } from '@/lib/http/errors';
import type { GenerationRun, GenerationRunStatus } from '@/types';

/**
 * Generation run lifecycle rules shared by the API routes and the SSE stream.
 *
 * Runs execute inside a request bounded by the route's `maxDuration`. If the
 * instance dies mid-run, nothing marks the run terminal, so any reader that
 * finds an active run older than `RUN_STALE_AFTER_MS` reaps it as timed out.
 * The threshold is deliberately larger than `maxDuration` so a live run is
 * never reaped by a concurrent reader.
 */

export const RUN_STALE_AFTER_MS = 120_000;

const TERMINAL_STATUSES: ReadonlySet<GenerationRunStatus> = new Set(['completed', 'failed', 'cancelled']);

export function isTerminal(status: GenerationRunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isStale(run: GenerationRun, now = Date.now()): boolean {
  return !isTerminal(run.status) && now - new Date(run.startedAt).getTime() > RUN_STALE_AFTER_MS;
}

/** Marks a stale run as failed and returns its current state; non-stale runs are returned unchanged. */
export async function reapIfStale(run: GenerationRun): Promise<GenerationRun> {
  if (!isStale(run)) return run;

  const timeout = {
    status: 'failed' as const,
    finishedAt: new Date().toISOString(),
    errorCode: 'RUN_TIMEOUT',
    errorMessage: `Generation run timed out after ${RUN_STALE_AFTER_MS / 60_000} minutes`,
  };
  const updated = await db.updateGenerationRun(run.id, timeout);
  return updated ?? { ...run, ...timeout };
}

/** Throws 409 when the project already has a live run; reaps a stale one so the caller can proceed. */
export async function assertNoActiveRun(projectId: string): Promise<void> {
  const latest = await db.getLatestGenerationRun(projectId);
  if (!latest) return;

  const current = await reapIfStale(latest);
  if (!isTerminal(current.status)) {
    throw conflict('A generation is already in progress for this project', { runId: current.id });
  }
}
