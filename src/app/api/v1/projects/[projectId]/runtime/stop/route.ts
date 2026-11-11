import { db } from '@/lib/db';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';

export const POST = apiRoute<{ projectId: string }>('runtime.stop', async (_req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  await requireOwnedProject(projectId, user.id);

  const session = await SandboxManager.stopSandbox(projectId);
  await db.recordAudit('runtime_stopped', projectId, user.id);

  return Response.json({ success: true, session });
}, { fallbackError: 'Failed to stop project runtime' });
