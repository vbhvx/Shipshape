import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootNodeServer } = await import('./instrumentation-node');
    bootNodeServer();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logger } = await import('@/lib/observability/logger');
  const digest = typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined;

  logger.error('request.unhandled_error', {
    err,
    digest,
    method: request.method,
    path: request.path,
    requestId: request.headers['x-request-id'],
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
};
