import { db } from '@/lib/db';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import { isTerminal } from '@/server/jobs/run-lifecycle';
import { requireAuth, requireOwnedRun } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';
import { conflict } from '@/lib/http/errors';

export const POST = apiRoute<{ runId: string }>('runs.cancel', async (_req, { params, log }) => {
  const user = await requireAuth();
  const { runId } = await params;
  const run = await requireOwnedRun(runId, user.id);

  if (isTerminal(run.status)) {
    throw conflict(`Cannot cancel run that is already in terminal state '${run.status}'`);
  }

  // Durable cancellation: the orchestrator on whichever instance owns the run observes this row.
  const updatedRun = await db.updateGenerationRun(runId, {
    status: 'cancelled',
    finishedAt: new Date().toISOString(),
  });

  if (!updatedRun || updatedRun.status !== 'cancelled') {
    throw conflict(
      `Cannot cancel run: run has already reached terminal state '${updatedRun?.status || 'unknown'}'`
    );
  }

  // Fast path when the run executes in this same process.
  ProjectOrchestrator.cancelRun(runId);

  await db.addGenerationEvent(runId, {
    generationRunId: runId,
    sequenceNumber: 999,
    eventType: 'error',
    message: 'Run was cancelled by user',
  });
  await db.recordAudit('run_cancelled', run.projectId, user.id, { runId });
  log.info('run.cancelled', { runId, projectId: run.projectId });

  return Response.json({ success: true, message: 'Run successfully cancelled' });
}, { fallbackError: 'Failed to cancel generation run' });
