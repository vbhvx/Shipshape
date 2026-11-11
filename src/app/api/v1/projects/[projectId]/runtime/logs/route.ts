import { db } from '@/lib/db';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';
import { notFound } from '@/lib/http/errors';

export const GET = apiRoute<{ projectId: string }>('runtime.logs', async (req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  await requireOwnedProject(projectId, user.id);

  const runId = req.nextUrl.searchParams.get('runId');
  if (!runId) {
    return Response.json({ success: true, logs: [] });
  }

  const run = await db.getGenerationRun(runId);
  if (!run || run.projectId !== projectId) {
    throw notFound('Generation run not found');
  }

  const logs = await db.getBuildLogs(runId);
  return Response.json({ success: true, logs });
}, { fallbackError: 'Failed to retrieve runtime logs' });
