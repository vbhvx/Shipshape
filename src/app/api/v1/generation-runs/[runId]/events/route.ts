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

    const encoder = new TextEncoder();
    let isAlive = true;
    let lastEventCount = 0;

    const streamStartTime = Date.now();

    const stream = new ReadableStream({
      async start(controller) {
        // Periodic poll and event dispatch loop
        const interval = setInterval(async () => {
          if (!isAlive) {
            clearInterval(interval);
            return;
          }

          try {
            let currentRun = await db.getGenerationRun(runId);
            if (!currentRun) {
              controller.enqueue(
                encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Run not found' })}\n\n`)
              );
              clearInterval(interval);
              controller.close();
              return;
            }

            // Stale run auto-reaper: fail any run that has been active for more than 2 minutes
            const isActive = !['completed', 'failed', 'cancelled'].includes(currentRun.status);
            const isStale = isActive && (Date.now() - new Date(currentRun.startedAt).getTime() > 120_000);
            if (isStale) {
              await db.updateGenerationRun(runId, {
                status: 'failed',
                finishedAt: new Date().toISOString(),
                errorCode: 'RUN_TIMEOUT',
                errorMessage: 'Generation timed out after 2 minutes',
              });
              currentRun = {
                ...currentRun,
                status: 'failed',
                finishedAt: new Date().toISOString(),
                errorCode: 'RUN_TIMEOUT',
                errorMessage: 'Generation timed out after 2 minutes',
              };
            }

            const events = await db.getGenerationEvents(runId);

            // Dispatch newly added events
            if (events.length > lastEventCount) {
              for (let i = lastEventCount; i < events.length; i++) {
                const evt = events[i];
                controller.enqueue(
                  encoder.encode(`id: ${evt.sequenceNumber}\nevent: message\ndata: ${JSON.stringify(evt)}\n\n`)
                );
              }
              lastEventCount = events.length;
            }

            // Emit status update
            controller.enqueue(
              encoder.encode(
                `event: status\ndata: ${JSON.stringify({
                  status: currentRun.status,
                  finishedAt: currentRun.finishedAt,
                })}\n\n`
              )
            );

            // If run has finished or max stream duration reached, close stream cleanly
            if (['completed', 'failed', 'cancelled'].includes(currentRun.status) || (Date.now() - streamStartTime > 120_000)) {
              clearInterval(interval);
              controller.enqueue(
                encoder.encode(`event: done\ndata: ${JSON.stringify({ status: currentRun.status })}\n\n`)
              );
              controller.close();
            }
          } catch (err: any) {
            console.error(`SSE stream error for run ${runId}:`, err);
            clearInterval(interval);
            controller.close();
          }
        }, 500);

        req.signal.addEventListener('abort', () => {
          isAlive = false;
          clearInterval(interval);
        });
      },
      cancel() {
        isAlive = false;
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to establish SSE stream:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to establish event stream' },
      { status: 500 }
    );
  }
}
