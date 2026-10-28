import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId, versionId } = await params;
    const project = await getOwnedProject(projectId, user.id);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const version = await db.getVersion(versionId);
    if (!version || version.projectId !== projectId) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });
    }

    const files = await db.getFilesForVersion(projectId, versionId);
    return NextResponse.json({ success: true, version, files });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to get project version:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to get project version' },
      { status: 500 }
    );
  }
}
