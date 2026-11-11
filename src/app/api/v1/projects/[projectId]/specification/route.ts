import { db } from '@/lib/db';
import { UpdateSpecificationSchema, type ProjectSpecification } from '@/types';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute, readJsonBody } from '@/lib/http/handler';
import { notFound, validationFailed } from '@/lib/http/errors';
import { enforceRateLimit, RateLimits } from '@/lib/http/rate-limit';

type Params = { projectId: string };

export const GET = apiRoute<Params>('projects.specification.get', async (_req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  await requireOwnedProject(projectId, user.id);

  const spec = await db.getSpecification(projectId);
  if (!spec) {
    throw notFound('Specification not found');
  }
  return Response.json({ success: true, specification: spec });
}, { fallbackError: 'Failed to get specification' });

export const PATCH = apiRoute<Params>('projects.specification.update', async (req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  await requireOwnedProject(projectId, user.id);
  await enforceRateLimit(RateLimits.mutation, user.id);

  const spec = await db.getSpecification(projectId);
  if (!spec) {
    throw notFound('Specification not found');
  }

  const parsed = UpdateSpecificationSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    throw validationFailed('Invalid specification update', parsed.error.flatten());
  }

  const updatedSpec = {
    ...spec,
    ...parsed.data,
    id: spec.id,
    projectId,
    versionNumber: spec.versionNumber + 1,
  } as ProjectSpecification;

  await db.saveSpecification(updatedSpec);
  await db.recordAudit('specification_updated', projectId, user.id, {
    fields: Object.keys(parsed.data),
    versionNumber: updatedSpec.versionNumber,
  });

  return Response.json({ success: true, specification: updatedSpec });
}, { fallbackError: 'Failed to update specification' });
