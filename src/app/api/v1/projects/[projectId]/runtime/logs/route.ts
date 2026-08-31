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

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId');

    if (runId) {
      const run = await db.getGenerationRun(runId);

      if (!run || run.projectId !== projectId) {
        return NextResponse.json(
          { success: false, error: 'Generation run not found' },
          { status: 404 }
        );
      }

      const logs = await db.getBuildLogs(runId);

      return NextResponse.json({ success: true, logs });
    }

    // Default: return no logs when a run ID is not specified.
    return NextResponse.json({ success: true, logs: [] });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to retrieve runtime logs:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to retrieve runtime logs' },
      { status: 500 }
    );
  }
}
