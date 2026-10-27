import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    const files = await db.getFilesForVersion(projectId, versionId);
    return NextResponse.json({ success: true, version, files });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
