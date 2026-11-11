import { db } from '@/lib/db';
import { createPlanFromPrompt } from '@/modules/planning/planning-engine';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import { assertNoActiveRun } from '@/server/jobs/run-lifecycle';
import { ApplicationPlan, GenerateRequestSchema, GenerationRun } from '@/types';
import { isGeminiConfigured, PRIMARY_MODEL } from '@/modules/ai/gemini-provider';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute, readJsonBody } from '@/lib/http/handler';
import { forbidden, validationFailed } from '@/lib/http/errors';
import { enforceRateLimit, RateLimits } from '@/lib/http/rate-limit';
import { newId } from '@/lib/ids';

// This workflow executes inside the request so a run always reaches a durable
// terminal state. A production deployment that needs longer AI jobs should
// replace this with a durable queue/worker, not a post-response callback.
export const maxDuration = 60;

export const POST = apiRoute<{ projectId: string }>('projects.generate', async (req, { params, log }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  const project = await requireOwnedProject(projectId, user.id);

  const parsed = GenerateRequestSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    throw validationFailed('Invalid generation request', parsed.error.flatten());
  }

  const isProd = process.env.NODE_ENV === 'production';
  const allowFixtures = !isProd || process.env.SHIPSHAPE_ALLOW_FIXTURES === 'true';
  if (parsed.data.modelProvider === 'fixture' && !allowFixtures) {
    throw forbidden('Fixture model provider is only available in development and testing environments.');
  }

  await assertNoActiveRun(projectId);
  // Counted only once the request is valid and runnable, so rejected requests do not burn quota.
  await enforceRateLimit(RateLimits.generation, user.id);

  let plan = parsed.data.plan as ApplicationPlan | undefined;

  // A new prompt intentionally produces a fresh plan. Reusing a prior
  // specification here made retries silently ignore what the user typed.
  if (!plan) {
    const spec = await db.getSpecification(projectId);

    if (spec && !parsed.data.prompt) {
      plan = await createPlanFromPrompt(projectId, project.name, spec.description, spec);
    } else {
      const prompt = parsed.data.prompt || project.description || 'Full-stack application';
      plan = await createPlanFromPrompt(projectId, project.name, prompt, spec);
      await db.saveSpecification(plan.specification);
    }
  }

  const runId = newId('run');
  const chosenProvider = parsed.data.modelProvider || (isGeminiConfigured() ? 'gemini' : 'deterministic');
  const chosenIdentifier =
    chosenProvider === 'gemini'
      ? PRIMARY_MODEL
      : chosenProvider === 'fixture'
      ? parsed.data.fixtureId || 'fixture-model-v1'
      : 'deterministic-engine-v1';

  const newRun: GenerationRun = {
    id: runId,
    projectId,
    runType: 'generation',
    status: 'queued',
    modelProvider: chosenProvider,
    modelIdentifier: chosenIdentifier,
    attemptCount: 1,
    prompt: parsed.data.prompt || project.description,
    startedAt: new Date().toISOString(),
  };

  await db.saveGenerationRun(newRun);
  await db.updateProject(projectId, { status: 'generating' });
  await db.recordAudit('generation_started', projectId, user.id, { runId, provider: chosenProvider });

  const startedAt = performance.now();
  const result = await ProjectOrchestrator.runFullGeneration(runId, projectId, plan);
  const run = await db.getGenerationRun(runId);

  log.info('generation.finished', {
    runId,
    projectId,
    provider: chosenProvider,
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
      ? 'Generation completed successfully'
      : 'Generation failed; inspect the run diagnostics for details',
  });
}, { fallbackError: 'Failed to start project generation' });
