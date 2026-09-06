import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computeVersionDiff } from '@/modules/versioning/diff-engine';
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
      return NextResponse.json(
        { success: false, error: 'Version not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const baseVersionId =
      searchParams.get('baseVersionId') || version.parentVersionId;

    let oldFiles: Awaited<ReturnType<typeof db.getFilesForVersion>> = [];

    if (baseVersionId) {
      const baseVersion = await db.getVersion(baseVersionId);

      if (!baseVersion || baseVersion.projectId !== projectId) {
        return NextResponse.json(
          { success: false, error: 'Base version not found' },
          { status: 404 }
        );
      }

      oldFiles = await db.getFilesForVersion(projectId, baseVersionId);
    }

    const newFiles = await db.getFilesForVersion(projectId, versionId);

    const diff = computeVersionDiff(
      oldFiles,
      newFiles,
      versionId,
      baseVersionId || undefined
    );

    return NextResponse.json({ success: true, diff });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to compute version diff:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to compute version diff' },
      { status: 500 }
    );
  }
}
