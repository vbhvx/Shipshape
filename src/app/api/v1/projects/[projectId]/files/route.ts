import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSafePath } from '@/server/security/safe-paths';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const project = await db.getProject(projectId);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get('versionId') || project.activeVersionId;
    const requestedPath = searchParams.get('path');

    if (!versionId) {
      return NextResponse.json({ success: true, files: [] });
    }

    if (requestedPath) {
      const check = validateSafePath(requestedPath);
      if (!check.isValid) {
        return NextResponse.json({ success: false, error: check.error }, { status: 400 });
      }

      const file = await db.getFile(projectId, versionId, check.normalizedPath);
      if (!file) {
        return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, file });
    }

    const files = await db.getFilesForVersion(projectId, versionId);
    return NextResponse.json({ success: true, files, versionId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
