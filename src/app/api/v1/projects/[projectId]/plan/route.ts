import { db } from '@/lib/db';
import { createPlanFromPrompt } from '@/modules/planning/planning-engine';
import { PlanRequestSchema } from '@/types';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute, readJsonBody } from '@/lib/http/handler';
import { assertNoActiveRun } from '@/server/jobs/run-lifecycle';
import { notFound, validationFailed } from '@/lib/http/errors';
import { enforceRateLimit, RateLimits } from '@/lib/http/rate-limit';

type Params = { projectId: string };

export const POST = apiRoute<Params>('projects.plan.create', async (req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  const project = await requireOwnedProject(projectId, user.id);

  const parsed = PlanRequestSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    throw validationFailed('Invalid prompt', parsed.error.format());
  }

  // A new plan moves the project to `planning`, which is not a legal step out of `generating`.
  await assertNoActiveRun(projectId);
  await enforceRateLimit(RateLimits.planning, user.id);

  const existingSpec = await db.getSpecification(projectId);
  const plan = await createPlanFromPrompt(projectId, project.name, parsed.data.prompt, existingSpec);

  await db.saveSpecification(plan.specification);
  await db.updateProject(projectId, { description: parsed.data.prompt, status: 'planning' });

  return Response.json({ success: true, plan });
}, { fallbackError: 'Failed to create project plan' });

export const GET = apiRoute<Params>('projects.plan.get', async (_req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  await requireOwnedProject(projectId, user.id);

  const spec = await db.getSpecification(projectId);
  if (!spec) {
    throw notFound('No plan or specification exists yet');
  }

  return Response.json({ success: true, specification: spec });
}, { fallbackError: 'Failed to retrieve project plan' });
