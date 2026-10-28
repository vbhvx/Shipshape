import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSafePath } from '@/server/security/safe-paths';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;
    const project = await getOwnedProject(projectId, user.id);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
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
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to get project files:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to get project files' },
      { status: 500 }
    );
  }
}
