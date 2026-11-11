import { db } from '@/lib/db';
import { computeVersionDiff } from '@/modules/versioning/diff-engine';
import { requireAuth, requireOwnedProject, requireProjectVersion } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';

export const GET = apiRoute<{ projectId: string; versionId: string }>('versions.diff', async (req, { params }) => {
  const user = await requireAuth();
  const { projectId, versionId } = await params;
  await requireOwnedProject(projectId, user.id);

  const version = await requireProjectVersion(projectId, versionId);
  const baseVersionId = req.nextUrl.searchParams.get('baseVersionId') || version.parentVersionId;

  let oldFiles: Awaited<ReturnType<typeof db.getFilesForVersion>> = [];
  if (baseVersionId) {
    await requireProjectVersion(projectId, baseVersionId, 'Base version');
    oldFiles = await db.getFilesForVersion(projectId, baseVersionId);
  }

  const newFiles = await db.getFilesForVersion(projectId, versionId);
  const diff = computeVersionDiff(oldFiles, newFiles, versionId, baseVersionId || undefined);

  return Response.json({ success: true, diff });
}, { fallbackError: 'Failed to compute version diff' });
