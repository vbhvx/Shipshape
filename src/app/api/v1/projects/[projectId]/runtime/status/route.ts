import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

    const session = await db.getSandboxSession(projectId);

    if (!session) {
      return NextResponse.json({
        success: true,
        session: {
          id: `sbx_${projectId}`,
          projectId,
          providerKey: 'isolated_node',
          status: 'stopped',
        },
      });
    }

    return NextResponse.json({ success: true, session });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to retrieve runtime status:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to retrieve runtime status' },
      { status: 500 }
    );
  }
}
