import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computeVersionDiff } from '@/modules/versioning/diff-engine';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  try {
    const { projectId, versionId } = await params;
    const version = await db.getVersion(versionId);
    if (!version || version.projectId !== projectId) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const baseVersionId = searchParams.get('baseVersionId') || version.parentVersionId;

    const newFiles = await db.getFilesForVersion(projectId, versionId);
    let oldFiles: any[] = [];

    if (baseVersionId) {
      oldFiles = await db.getFilesForVersion(projectId, baseVersionId);
    }

    const diff = computeVersionDiff(oldFiles, newFiles, versionId, baseVersionId || undefined);

    return NextResponse.json({ success: true, diff });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
