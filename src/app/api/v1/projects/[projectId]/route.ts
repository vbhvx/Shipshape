import { db } from '@/lib/db';
import { UpdateProjectSchema } from '@/types';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute, readJsonBody } from '@/lib/http/handler';
import { notFound, validationFailed } from '@/lib/http/errors';
import { enforceRateLimit, RateLimits } from '@/lib/http/rate-limit';

type Params = { projectId: string };

export const GET = apiRoute<Params>('projects.get', async (_req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  const project = await requireOwnedProject(projectId, user.id);

  const [versions, spec, sandbox, latestRun] = await Promise.all([
    db.listVersions(projectId),
    db.getSpecification(projectId),
    db.getSandboxSession(projectId),
    db.getLatestGenerationRun(projectId),
  ]);

  return Response.json({
    success: true,
    project,
    specification: spec,
    latestVersion: versions[0] || null,
    versionsCount: versions.length,
    sandbox,
    activeRun: latestRun,
  });
}, { fallbackError: 'Failed to get project' });

export const PATCH = apiRoute<Params>('projects.update', async (req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  await requireOwnedProject(projectId, user.id);
  await enforceRateLimit(RateLimits.mutation, user.id);

  const parsed = UpdateProjectSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    throw validationFailed('Validation failed', parsed.error.format());
  }

  if (parsed.data.activeVersionId) {
    // Prevent pointing a project at another tenant's version.
    const version = await db.getVersion(parsed.data.activeVersionId);
    if (!version || version.projectId !== projectId) {
      throw notFound('Version not found');
    }
  }

  const updated = await db.updateProject(projectId, parsed.data);
  if (!updated) {
    throw notFound('Project not found');
  }
  await db.recordAudit('project_updated', projectId, user.id, { fields: Object.keys(parsed.data) });

  return Response.json({ success: true, project: updated });
}, { fallbackError: 'Failed to update project' });

export const DELETE = apiRoute<Params>('projects.archive', async (_req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  await requireOwnedProject(projectId, user.id);

  const success = await db.deleteProject(projectId);
  if (!success) {
    throw notFound('Project not found');
  }
  await db.recordAudit('project_archived', projectId, user.id);

  return Response.json({ success: true, message: 'Project archived' });
}, { fallbackError: 'Failed to delete project' });
