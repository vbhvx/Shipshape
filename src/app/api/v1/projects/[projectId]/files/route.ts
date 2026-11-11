import { db } from '@/lib/db';
import { validateSafePath } from '@/server/security/safe-paths';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';
import { badRequest, notFound } from '@/lib/http/errors';

export const GET = apiRoute<{ projectId: string }>('projects.files', async (req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  const project = await requireOwnedProject(projectId, user.id);

  const { searchParams } = req.nextUrl;
  const versionId = searchParams.get('versionId') || project.activeVersionId;
  const requestedPath = searchParams.get('path');

  if (!versionId) {
    return Response.json({ success: true, files: [] });
  }

  if (requestedPath) {
    const check = validateSafePath(requestedPath);
    if (!check.isValid) {
      throw badRequest(check.error ?? 'Invalid file path');
    }

    // Lookups are scoped by projectId, so a foreign versionId simply finds nothing.
    const file = await db.getFile(projectId, versionId, check.normalizedPath);
    if (!file) {
      throw notFound('File not found');
    }
    return Response.json({ success: true, file });
  }

  const files = await db.getFilesForVersion(projectId, versionId);
  return Response.json({ success: true, files, versionId });
}, { fallbackError: 'Failed to get project files' });
