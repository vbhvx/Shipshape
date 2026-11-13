import type { GenerationRun, GenerationRunStatus } from '@/types';

/**
 * Generation run status rules shared by the server (reaping, conflict checks)
 * and the workspace UI (when to stream, poll or stop). Pure functions with no
 * server dependencies, so both sides read one definition.
 */

const TERMINAL_STATUSES: ReadonlySet<GenerationRunStatus> = new Set(['completed', 'failed', 'cancelled']);

/**
 * An active run older than this is treated as abandoned (its instance died).
 * Deliberately longer than the generate/modify routes' 60s `maxDuration`, so a
 * live run is never reaped by a concurrent reader.
 */
export const RUN_STALE_AFTER_MS = 120_000;

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status as GenerationRunStatus);
}

export function isRunStale(run: Pick<GenerationRun, 'status' | 'startedAt'>, now = Date.now()): boolean {
  return !isTerminalStatus(run.status) && now - new Date(run.startedAt).getTime() > RUN_STALE_AFTER_MS;
}
