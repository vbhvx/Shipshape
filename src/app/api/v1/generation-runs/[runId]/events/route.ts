import { db } from '@/lib/db';
import { requireAuth, requireOwnedRun } from '@/lib/auth/session';
import { isTerminal, reapIfStale } from '@/server/jobs/run-lifecycle';
import { apiRoute } from '@/lib/http/handler';

const POLL_INTERVAL_MS = 500;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_STREAM_DURATION_MS = 120_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Server-Sent Events feed for a generation run.
 *
 * Events are persisted by the orchestrator, so this stream polls durable
 * storage rather than an in-process emitter: it works no matter which instance
 * is executing the run. Polling is sequential (never overlapping queries),
 * status frames are sent only on change, and comment heartbeats keep idle
 * proxies from closing the connection.
 */
export const GET = apiRoute<{ runId: string }>('runs.events', async (req, { params, log }) => {
  const user = await requireAuth();
  const { runId } = await params;
  await requireOwnedRun(runId, user.id);

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: string) => {
        if (!closed) controller.enqueue(encoder.encode(frame));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };
      req.signal.addEventListener('abort', close);

      const startedAt = Date.now();
      let lastHeartbeat = startedAt;
      let lastEventCount = 0;
      let lastStatus: string | null = null;

      try {
        while (!closed) {
          const found = await db.getGenerationRun(runId);
          if (!found) {
            send(`event: error\ndata: ${JSON.stringify({ error: 'Run not found' })}\n\n`);
            break;
          }
          const run = await reapIfStale(found);

          const events = await db.getGenerationEvents(runId);
          for (const evt of events.slice(lastEventCount)) {
            send(`id: ${evt.sequenceNumber}\nevent: message\ndata: ${JSON.stringify(evt)}\n\n`);
          }
          lastEventCount = Math.max(lastEventCount, events.length);

          if (run.status !== lastStatus) {
            send(`event: status\ndata: ${JSON.stringify({ status: run.status, finishedAt: run.finishedAt })}\n\n`);
            lastStatus = run.status;
          }

          if (isTerminal(run.status) || Date.now() - startedAt > MAX_STREAM_DURATION_MS) {
            send(`event: done\ndata: ${JSON.stringify({ status: run.status })}\n\n`);
            break;
          }

          if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
            send(`: heartbeat\n\n`);
            lastHeartbeat = Date.now();
          }

          await sleep(POLL_INTERVAL_MS);
        }
      } catch (err) {
        log.error('runs.events.stream_failed', { runId, err });
      } finally {
        close();
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}, { fallbackError: 'Failed to establish event stream' });
