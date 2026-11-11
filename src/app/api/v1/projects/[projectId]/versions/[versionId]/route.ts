import { db } from '@/lib/db';
import { requireAuth, requireOwnedProject, requireProjectVersion } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';

export const GET = apiRoute<{ projectId: string; versionId: string }>('versions.get', async (_req, { params }) => {
  const user = await requireAuth();
  const { projectId, versionId } = await params;
  await requireOwnedProject(projectId, user.id);

  const version = await requireProjectVersion(projectId, versionId);
  const files = await db.getFilesForVersion(projectId, versionId);
  return Response.json({ success: true, version, files });
}, { fallbackError: 'Failed to get project version' });
