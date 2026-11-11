import { db } from '@/lib/db';
import { requireAuth, requireOwnedRun } from '@/lib/auth/session';
import { reapIfStale } from '@/server/jobs/run-lifecycle';
import { apiRoute } from '@/lib/http/handler';

export const GET = apiRoute<{ runId: string }>('runs.get', async (_req, { params }) => {
  const user = await requireAuth();
  const { runId } = await params;
  const run = await reapIfStale(await requireOwnedRun(runId, user.id));

  const [events, buildLogs, buildResults] = await Promise.all([
    db.getGenerationEvents(runId),
    db.getBuildLogs(runId),
    db.getBuildResults(runId),
  ]);

  return Response.json({ success: true, run, events, buildLogs, buildResults });
}, { fallbackError: 'Failed to retrieve generation run' });
