import { db } from '@/lib/db';
import { restoreVersion } from '@/modules/versioning/diff-engine';
import { RestoreVersionSchema } from '@/types';
import { requireAuth, requireOwnedProject, requireProjectVersion } from '@/lib/auth/session';
import { apiRoute, readJsonBody } from '@/lib/http/handler';
import { validationFailed } from '@/lib/http/errors';
import { enforceRateLimit, RateLimits } from '@/lib/http/rate-limit';

export const POST = apiRoute<{ projectId: string }>('projects.restore', async (req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  await requireOwnedProject(projectId, user.id);
  await enforceRateLimit(RateLimits.mutation, user.id);

  const parsed = RestoreVersionSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    throw validationFailed('Invalid restore request', parsed.error.format());
  }

  await requireProjectVersion(projectId, parsed.data.versionId);

  const newVersion = await restoreVersion(projectId, parsed.data.versionId, parsed.data.reason);
  await db.recordAudit('version_restored', projectId, user.id, {
    fromVersionId: parsed.data.versionId,
    newVersionId: newVersion.id,
  });

  return Response.json({
    success: true,
    restoredVersion: newVersion,
    message: `Successfully restored version to new snapshot v${newVersion.versionNumber}`,
  });
}, { fallbackError: 'Failed to restore project version' });
