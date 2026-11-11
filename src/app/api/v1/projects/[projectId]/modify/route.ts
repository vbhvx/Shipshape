import { db } from '@/lib/db';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import { assertNoActiveRun } from '@/server/jobs/run-lifecycle';
import { ModifyRequestSchema, GenerationRun } from '@/types';
import { isGeminiConfigured, PRIMARY_MODEL } from '@/modules/ai/gemini-provider';
import { requireAuth, requireOwnedProject, requireProjectVersion } from '@/lib/auth/session';
import { apiRoute, readJsonBody } from '@/lib/http/handler';
import { validationFailed } from '@/lib/http/errors';
import { enforceRateLimit, RateLimits } from '@/lib/http/rate-limit';
import { newId } from '@/lib/ids';

// See generate/route.ts: the current in-process workflow must complete before
// returning so it cannot be stranded by a serverless post-response shutdown.
export const maxDuration = 60;

export const POST = apiRoute<{ projectId: string }>('projects.modify', async (req, { params, log }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  const project = await requireOwnedProject(projectId, user.id);

  const parsed = ModifyRequestSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    throw validationFailed('Invalid modification instruction', parsed.error.format());
  }

  const baseVersionId = parsed.data.baseVersionId || project.activeVersionId;

  await assertNoActiveRun(projectId);

  if (baseVersionId) {
    await requireProjectVersion(projectId, baseVersionId, 'Base version');
  }

  await enforceRateLimit(RateLimits.generation, user.id);

  const runId = newId('run_mod');
  const chosenProvider = isGeminiConfigured() ? 'gemini' : 'deterministic';
  const chosenIdentifier = chosenProvider === 'gemini' ? PRIMARY_MODEL : 'deterministic-engine-v1';

  const newRun: GenerationRun = {
    id: runId,
    projectId,
    baseVersionId,
    runType: 'modification',
    status: 'queued',
    modelProvider: chosenProvider,
    modelIdentifier: chosenIdentifier,
    attemptCount: 1,
    prompt: parsed.data.instruction,
    startedAt: new Date().toISOString(),
  };

  await db.saveGenerationRun(newRun);
  await db.updateProject(projectId, { status: 'generating' });
  await db.recordAudit('modification_started', projectId, user.id, { runId, baseVersionId });

  const startedAt = performance.now();
  const result = await ProjectOrchestrator.runModification(
    runId,
    projectId,
    parsed.data.instruction,
    baseVersionId
  );
  const run = await db.getGenerationRun(runId);

  log.info('modification.finished', {
    runId,
    projectId,
    status: run?.status,
    success: result.success,
    durationMs: Math.round(performance.now() - startedAt),
  });

  return Response.json({
    success: true,
    runId,
    run,
    status: run?.status || (result.success ? 'completed' : 'failed'),
    message: result.success
      ? 'Modification completed successfully'
      : 'Modification failed; inspect the run diagnostics for details',
  });
}, { fallbackError: 'Failed to start project modification' });
