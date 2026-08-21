import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { restoreVersion } from '@/modules/versioning/diff-engine';
import { RestoreVersionSchema } from '@/types';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

export async function POST(
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

    const body = await req.json();
    const parsed = RestoreVersionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid restore request',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const version = await db.getVersion(parsed.data.versionId);

    if (!version || version.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: 'Version not found' },
        { status: 404 }
      );
    }

    const newVersion = await restoreVersion(
      projectId,
      parsed.data.versionId,
      parsed.data.reason
    );

    return NextResponse.json({
      success: true,
      restoredVersion: newVersion,
      message: `Successfully restored version to new snapshot v${newVersion.versionNumber}`,
    });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to restore project version:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to restore project version' },
      { status: 500 }
    );
  }
}
