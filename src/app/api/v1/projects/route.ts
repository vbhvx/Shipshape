import { db } from '@/lib/db';
import { CreateProjectSchema } from '@/types';
import { requireAuth } from '@/lib/auth/session';
import { apiRoute, readJsonBody } from '@/lib/http/handler';
import { validationFailed } from '@/lib/http/errors';
import { enforceRateLimit, RateLimits } from '@/lib/http/rate-limit';
import { newId } from '@/lib/ids';

export const GET = apiRoute('projects.list', async () => {
  const user = await requireAuth();
  const projects = await db.listProjects(user.id);

  return Response.json({ success: true, projects });
}, { fallbackError: 'Failed to list projects' });

export const POST = apiRoute('projects.create', async (req) => {
  const user = await requireAuth();
  await enforceRateLimit(RateLimits.mutation, user.id);

  const parsed = CreateProjectSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    throw validationFailed('Invalid project data', parsed.error.flatten());
  }

  const projectId = newId('proj');
  const project = await db.createProject({
    id: projectId,
    ownerUserId: user.id,
    name: parsed.data.name,
    description: parsed.data.description,
    status: 'draft',
  });

  await db.recordAudit('project_created', projectId, user.id, { name: project.name });

  return Response.json({ success: true, project }, { status: 201 });
}, { fallbackError: 'Failed to create project' });
