import { db } from '@/lib/db';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';

export const GET = apiRoute<{ projectId: string }>('versions.list', async (_req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  const project = await requireOwnedProject(projectId, user.id);

  const versions = await db.listVersions(projectId);
  return Response.json({ success: true, versions, activeVersionId: project.activeVersionId });
}, { fallbackError: 'Failed to list project versions' });
