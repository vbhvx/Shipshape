import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const encoder = new TextEncoder();

  let isAlive = true;
  let lastEventCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      // Periodic poll and event dispatch loop
      const interval = setInterval(async () => {
        if (!isAlive) {
          clearInterval(interval);
          return;
        }

        try {
          const run = await db.getGenerationRun(runId);
          if (!run) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Run not found' })}\n\n`));
            clearInterval(interval);
            controller.close();
            return;
          }

          const events = await db.getGenerationEvents(runId);

          // Dispatch newly added events
          if (events.length > lastEventCount) {
            for (let i = lastEventCount; i < events.length; i++) {
              const evt = events[i];
              controller.enqueue(encoder.encode(`id: ${evt.sequenceNumber}\nevent: message\ndata: ${JSON.stringify(evt)}\n\n`));
            }
            lastEventCount = events.length;
          }

          // Emit status update
          controller.enqueue(
            encoder.encode(`event: status\ndata: ${JSON.stringify({ status: run.status, finishedAt: run.finishedAt })}\n\n`)
          );

          // If run has finished, close stream cleanly
          if (['completed', 'failed', 'cancelled'].includes(run.status)) {
            clearInterval(interval);
            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ status: run.status })}\n\n`));
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
}
