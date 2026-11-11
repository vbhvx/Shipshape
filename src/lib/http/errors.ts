/**
 * Typed API errors.
 *
 * Route handlers throw these instead of hand-building error responses; the
 * `apiRoute` wrapper converts them into the public `{ success: false, error }`
 * envelope with a stable machine-readable `code`.
 */

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly options: {
      status?: number;
      details?: unknown;
      headers?: Record<string, string>;
      /** Extra top-level fields merged into the error body (kept for API compatibility). */
      extra?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? DEFAULT_STATUS[code];
  }
}

export const notFound = (message = 'Not found') => new ApiError('NOT_FOUND', message);

export const badRequest = (message: string, details?: unknown) =>
  new ApiError('BAD_REQUEST', message, { details });

export const validationFailed = (message: string, details?: unknown) =>
  new ApiError('VALIDATION_FAILED', message, { details });

export const conflict = (message: string, extra?: Record<string, unknown>) =>
  new ApiError('CONFLICT', message, { extra });

export const forbidden = (message: string) => new ApiError('FORBIDDEN', message);
