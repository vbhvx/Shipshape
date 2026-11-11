import { db } from '@/lib/db';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';

export const GET = apiRoute<{ projectId: string }>('runtime.status', async (_req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  await requireOwnedProject(projectId, user.id);

  const session = (await db.getSandboxSession(projectId)) ?? {
    id: `sbx_${projectId}`,
    projectId,
    providerKey: 'isolated_node',
    status: 'stopped',
  };

  return Response.json({ success: true, session });
}, { fallbackError: 'Failed to retrieve runtime status' });
