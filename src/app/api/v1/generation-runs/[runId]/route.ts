import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const user = await requireAuth();
    const { runId } = await params;

    const run = await db.getGenerationRun(runId);
    if (!run) {
      return NextResponse.json(
        { success: false, error: 'Generation run not found' },
        { status: 404 }
      );
    }

    const project = await getOwnedProject(run.projectId, user.id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Generation run not found' },
        { status: 404 }
      );
    }

    const events = await db.getGenerationEvents(runId);
    const logs = await db.getBuildLogs(runId);
    const buildResults = await db.getBuildResults(runId);

    return NextResponse.json({
      success: true,
      run,
      events,
      logsCount: logs.length,
      buildResults,
    });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to retrieve generation run:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to retrieve generation run' },
      { status: 500 }
    );
  }
}
