import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const run = await db.getGenerationRun(runId);
    if (!run) {
      return NextResponse.json({ success: false, error: 'Generation run not found' }, { status: 404 });
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
