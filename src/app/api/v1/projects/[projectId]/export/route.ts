import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { exportProjectArchive } from '@/modules/export/export-service';
import { requireAuth, requireOwnedProject, requireProjectVersion } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';

/** RFC 6266 filename: an ASCII fallback plus a UTF-8 encoded variant, so names cannot break the header. */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]|["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

const exportArchive = apiRoute<{ projectId: string }>('projects.export', async (req: NextRequest, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  await requireOwnedProject(projectId, user.id);

  const versionId = req.nextUrl.searchParams.get('versionId') || undefined;
  if (versionId) {
    await requireProjectVersion(projectId, versionId);
  }

  const exportResult = await exportProjectArchive(projectId, versionId);
  await db.recordAudit('project_exported', projectId, user.id, {
    versionId,
    files: exportResult.filesIncluded,
  });

  return new Response(new Uint8Array(exportResult.zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition(exportResult.fileName),
      'Content-Length': exportResult.totalBytes.toString(),
      'X-Export-Files-Count': exportResult.filesIncluded.toString(),
    },
  });
}, { fallbackError: 'Failed to export project archive' });

export const GET = exportArchive;
export const POST = exportArchive;
