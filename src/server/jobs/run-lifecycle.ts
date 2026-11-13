import { db } from '@/lib/db';
import { conflict } from '@/lib/http/errors';
import type { GenerationRun } from '@/types';
import { isRunStale, isTerminalStatus, projectStatusAfterRun, RUN_STALE_AFTER_MS } from '@/lib/runs/status';
import { logger } from '@/lib/observability/logger';

/**
 * Database-bound run lifecycle operations used by the API routes and the SSE stream.
 *
 * Runs execute inside a request bounded by the route's `maxDuration`. If the
 * instance dies mid-run, nothing marks the run terminal, so any reader that
 * finds an active run older than `RUN_STALE_AFTER_MS` reaps it as timed out.
 * The status rules themselves live in `src/lib/runs/status.ts`, shared with
 * the workspace UI.
 */

/** Marks a stale run as failed and returns its current state; non-stale runs are returned unchanged. */
export async function reapIfStale(run: GenerationRun): Promise<GenerationRun> {
  if (!isRunStale(run)) return run;

  const timeout = {
    status: 'failed' as const,
    finishedAt: new Date().toISOString(),
    errorCode: 'RUN_TIMEOUT',
    errorMessage: `Generation run timed out after ${RUN_STALE_AFTER_MS / 60_000} minutes`,
  };
  const updated = await db.updateGenerationRun(run.id, timeout);
  await settleProjectAfterRun(run.id, run.projectId);
  return updated ?? { ...run, ...timeout };
}

/**
 * Moves a project out of `generating` once its run has ended, whichever way it
 * ended: published, failed (including exhausted repairs and timeouts) or
 * cancelled. Safe to call more than once and from any instance. It only acts
 * when the run is the project's latest, so reaping an old run never overwrites
 * the status a newer run set.
 */
export async function settleProjectAfterRun(runId: string, projectId: string): Promise<void> {
  try {
    const [run, latest, project] = await Promise.all([
      db.getGenerationRun(runId),
      db.getLatestGenerationRun(projectId),
      db.getProject(projectId),
    ]);
    if (!run || !project || !isTerminalStatus(run.status)) return;
    if (latest && latest.id !== run.id) return;

    const next = projectStatusAfterRun(run.status, Boolean(project.activeVersionId));
    if (project.status !== next) {
      await db.updateProject(projectId, { status: next });
    }
  } catch (err) {
    // The run's own outcome is already durable; a project left behind is corrected by the next run.
    logger.error('run.project_settle_failed', { runId, projectId, err });
  }
}

/** Throws 409 when the project already has a live run; reaps a stale one so the caller can proceed. */
export async function assertNoActiveRun(projectId: string): Promise<void> {
  const latest = await db.getLatestGenerationRun(projectId);
  if (!latest) return;

  const current = await reapIfStale(latest);
  if (!isTerminalStatus(current.status)) {
    throw conflict('A generation is already in progress for this project', { runId: current.id });
  }
}
