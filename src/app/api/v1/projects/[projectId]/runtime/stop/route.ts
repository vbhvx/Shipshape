import { NextRequest, NextResponse } from 'next/server';
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

    const session = await SandboxManager.stopSandbox(projectId);

    return NextResponse.json({ success: true, session });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to stop project runtime:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to stop project runtime' },
      { status: 500 }
    );
  }
}
