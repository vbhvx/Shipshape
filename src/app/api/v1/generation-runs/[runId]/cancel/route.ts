import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const run = await db.getGenerationRun(runId);
    if (!run) {
      return NextResponse.json({ success: false, error: 'Generation run not found' }, { status: 404 });
    }

    if (['completed', 'failed', 'cancelled'].includes(run.status)) {
      return NextResponse.json({
        success: false,
        error: `Cannot cancel run that is already in terminal state '${run.status}'`,
      });
    }

    ProjectOrchestrator.cancelRun(runId);
    await db.updateGenerationRun(runId, {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
    });
    await db.addGenerationEvent(runId, {
      generationRunId: runId,
      sequenceNumber: 999,
      eventType: 'error',
      message: 'Run was cancelled by user',
    });

    return NextResponse.json({ success: true, message: 'Run successfully cancelled' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
