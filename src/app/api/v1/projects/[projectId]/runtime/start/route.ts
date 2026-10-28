import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';
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

    if (!project.activeVersionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot start runtime: No generated version exists yet',
        },
        { status: 400 }
      );
    }

    const files = await db.getFilesForVersion(
      projectId,
      project.activeVersionId
    );

    const session = await SandboxManager.startSandbox(projectId, files);

    await db.updateProject(projectId, { status: 'running' });

    return NextResponse.json({ success: true, session });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to start project runtime:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to start project runtime' },
      { status: 500 }
    );
  }
}
