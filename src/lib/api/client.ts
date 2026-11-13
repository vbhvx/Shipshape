/**
 * Browser client for the `/api/v1` routes.
 *
 * Every response from the API uses one envelope: `{ success: true, ...data }`
 * or `{ success: false, error, code, requestId }`. This module turns that into
 * plain return values and one thrown error type, so UI code never parses JSON,
 * checks `res.ok` or forgets that `fetch` does not throw on HTTP errors.
 */

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

type ErrorEnvelope = { success?: boolean; error?: string; code?: string; requestId?: string; details?: unknown };

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toError(res: Response, body: unknown, fallback: string): ApiClientError {
  const envelope = (body ?? {}) as ErrorEnvelope;
  return new ApiClientError(
    envelope.error || fallback,
    res.status,
    envelope.code || `HTTP_${res.status}`,
    envelope.requestId ?? res.headers.get('x-request-id') ?? undefined,
    envelope.details
  );
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch {
    throw new ApiClientError('Could not reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Sent as a JSON body with the matching Content-Type. */
  json?: unknown;
}

/** Calls a JSON endpoint and returns its success envelope; throws `ApiClientError` otherwise. */
export async function apiRequest<T>(path: string, { json, headers, ...init }: RequestOptions = {}): Promise<T> {
  const res = await send(path, {
    ...init,
    headers: json === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
    body: json === undefined ? undefined : JSON.stringify(json),
  });

  const body = await readJson(res);
  if (!res.ok || (body as ErrorEnvelope | null)?.success === false) {
    throw toError(res, body, `Request failed (${res.status})`);
  }
  return body as T;
}

/** Reads the file name from a Content-Disposition header, preferring the RFC 6266 UTF-8 form. */
export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // fall through to the plain form
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

/** Downloads a file endpoint through the browser, using the server's file name. */
export async function downloadFile(path: string, fallbackName: string): Promise<string> {
  const res = await send(path, {});
  if (!res.ok) {
    throw toError(res, await readJson(res), `Download failed (${res.status})`);
  }

  const name = fileNameFromDisposition(res.headers.get('content-disposition')) ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return name;
}

/** A message safe to show a user, with the request id when the server gave one (for support). */
export function describeError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiClientError) {
    return err.requestId && err.status >= 500 ? `${err.message} (reference ${err.requestId})` : err.message;
  }
  return fallback;
}
