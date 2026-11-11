import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { AuthSessionError } from '@/lib/auth/session';
import { logger, type Logger } from '@/lib/observability/logger';
import { ApiError, type ApiErrorCode } from './errors';

/**
 * Route handler wrapper shared by every `/api/v1` endpoint.
 *
 * It owns the cross-cutting concerns that were previously copy-pasted into each
 * route: request correlation IDs, one structured access-log line per request,
 * and the mapping from thrown errors to the public error envelope. Handlers
 * contain only business logic and signal failures by throwing `ApiError`.
 *
 * Error envelope (stable contract consumed by the workspace UI):
 *   { success: false, error: string, code: ApiErrorCode, requestId: string, details? }
 */

export interface ApiContext<P> {
  params: Promise<P>;
  requestId: string;
  log: Logger;
}

type RouteHandler<P> = (req: NextRequest, ctx: ApiContext<P>) => Promise<Response>;

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function resolveRequestId(req: NextRequest): string {
  const inbound = req.headers.get(REQUEST_ID_HEADER);
  // Accept upstream IDs (load balancer, client) only when well-formed, to keep logs injection-safe.
  return inbound && REQUEST_ID_PATTERN.test(inbound) ? inbound : crypto.randomUUID();
}

function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): NextResponse {
  return NextResponse.json(
    { success: false, error: message, code, requestId, ...extra },
    { status, headers }
  );
}

export function toErrorResponse(err: unknown, requestId: string, fallbackMessage: string): NextResponse {
  if (err instanceof ApiError) {
    return errorResponse(
      err.status,
      err.code,
      err.message,
      requestId,
      {
        ...(err.options.details !== undefined ? { details: err.options.details } : {}),
        ...err.options.extra,
      },
      err.options.headers
    );
  }

  if (err instanceof AuthSessionError) {
    const code: ApiErrorCode = err.status === 401 ? 'UNAUTHENTICATED' : err.status === 403 ? 'FORBIDDEN' : 'CONFLICT';
    return errorResponse(err.status, code, err.message, requestId);
  }

  if (err instanceof ZodError) {
    return errorResponse(400, 'VALIDATION_FAILED', 'Validation failed', requestId, {
      details: err.flatten(),
    });
  }

  // Unknown failures never leak internals to the client; the request ID links the response to the log line.
  return errorResponse(500, 'INTERNAL_ERROR', fallbackMessage, requestId);
}

export function apiRoute<P = Record<string, never>>(
  operation: string,
  handler: RouteHandler<P>,
  options: { fallbackError?: string } = {}
) {
  const fallbackMessage = options.fallbackError ?? 'An unexpected error occurred';

  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    const startedAt = performance.now();
    const requestId = resolveRequestId(req);
    const log = logger.child({ requestId, operation });

    let response: Response;
    let failure: unknown;

    try {
      response = await handler(req, { params: context?.params ?? Promise.resolve({} as P), requestId, log });
    } catch (err) {
      failure = err;
      response = toErrorResponse(err, requestId, fallbackMessage);
    }

    const durationMs = Math.round(performance.now() - startedAt);
    const fields = { method: req.method, path: req.nextUrl.pathname, status: response.status, durationMs };

    if (response.status >= 500) {
      log.error('request.failed', { ...fields, err: failure });
    } else if (failure) {
      log.warn('request.rejected', { ...fields, reason: (failure as Error).message });
    } else {
      log.info('request.completed', fields);
    }

    try {
      response.headers.set(REQUEST_ID_HEADER, requestId);
    } catch {
      // Some responses (e.g. Response.redirect) expose immutable headers.
    }
    return response;
  };
}

/**
 * Parses a JSON request body, mapping malformed payloads to 400 and enforcing a size cap
 * before the body is buffered further into business logic.
 */
export async function readJsonBody(req: NextRequest, { maxBytes = 1_000_000 } = {}): Promise<unknown> {
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) {
    throw new ApiError('PAYLOAD_TOO_LARGE', `Request body exceeds ${maxBytes} bytes`);
  }

  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) {
    throw new ApiError('PAYLOAD_TOO_LARGE', `Request body exceeds ${maxBytes} bytes`);
  }
  if (text.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('BAD_REQUEST', 'Request body must be valid JSON');
  }
}
