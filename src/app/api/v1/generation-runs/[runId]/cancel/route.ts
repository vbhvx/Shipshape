import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

export async function POST(
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

    if (['completed', 'failed', 'cancelled'].includes(run.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot cancel run that is already in terminal state '${run.status}'`,
        },
        { status: 409 }
      );
    }

    // Attempt durable cancellation in database
    const updatedRun = await db.updateGenerationRun(runId, {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
    });

    if (!updatedRun || updatedRun.status !== 'cancelled') {
      const currentStatus = updatedRun?.status || 'unknown';
      return NextResponse.json(
        {
          success: false,
          error: `Cannot cancel run: run has already reached terminal state '${currentStatus}'`,
        },
        { status: 409 }
      );
    }

    // Also notify in-memory orchestrator if running in the same process
    ProjectOrchestrator.cancelRun(runId);

    // Only record cancellation event if durable cancellation actually succeeded
    await db.addGenerationEvent(runId, {
      generationRunId: runId,
      sequenceNumber: 999,
      eventType: 'error',
      message: 'Run was cancelled by user',
    });

    return NextResponse.json({ success: true, message: 'Run successfully cancelled' });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to cancel generation run:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to cancel generation run' },
      { status: 500 }
    );
  }
}
