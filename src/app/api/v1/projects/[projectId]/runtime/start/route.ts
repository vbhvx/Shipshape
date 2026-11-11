import { db } from '@/lib/db';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';
import { badRequest } from '@/lib/http/errors';
import { enforceRateLimit, RateLimits } from '@/lib/http/rate-limit';

export const POST = apiRoute<{ projectId: string }>('runtime.start', async (_req, { params, log }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  const project = await requireOwnedProject(projectId, user.id);

  if (!project.activeVersionId) {
    throw badRequest('Cannot start runtime: No generated version exists yet');
  }

  await enforceRateLimit(RateLimits.runtime, user.id);

  const files = await db.getFilesForVersion(projectId, project.activeVersionId);
  const session = await SandboxManager.startSandbox(projectId, files);
  await db.updateProject(projectId, { status: 'running' });
  await db.recordAudit('runtime_started', projectId, user.id, { versionId: project.activeVersionId });
  log.info('runtime.started', { projectId, sessionStatus: session.status });

  return Response.json({ success: true, session });
}, { fallbackError: 'Failed to start project runtime' });
