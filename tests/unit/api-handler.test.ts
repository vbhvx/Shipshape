import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiRoute, readJsonBody } from '@/lib/http/handler';
import { ApiError, notFound, conflict } from '@/lib/http/errors';
import { AuthSessionError } from '@/lib/auth/session';

const ctx = <P>(params: P) => ({ params: Promise.resolve(params) });

function request(init: { body?: string; headers?: Record<string, string>; method?: string } = {}) {
  return new NextRequest('http://localhost/api/v1/test', {
    method: init.method ?? 'POST',
    body: init.body,
    headers: init.headers,
  });
}

describe('apiRoute', () => {
  it('passes route params through and attaches a request id', async () => {
    const handler = apiRoute<{ id: string }>('test.ok', async (_req, { params, requestId }) => {
      const { id } = await params;
      return Response.json({ success: true, id, requestId });
    });

    const res = await handler(request({ method: 'GET' }), ctx({ id: 'abc' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe('abc');
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('propagates a well-formed inbound request id and replaces a malformed one', async () => {
    const handler = apiRoute('test.id', async () => Response.json({ success: true }));

    const kept = await handler(request({ headers: { 'x-request-id': 'lb-trace-12345678' } }), ctx({}));
    expect(kept.headers.get('x-request-id')).toBe('lb-trace-12345678');

    const replaced = await handler(request({ headers: { 'x-request-id': 'bad id; drop table' } }), ctx({}));
    expect(replaced.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('maps ApiError to the public envelope with code, details and extra fields', async () => {
    const handler = apiRoute('test.conflict', async () => {
      throw conflict('A generation is already in progress for this project', { runId: 'run_1' });
    });

    const res = await handler(request(), ctx({}));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toMatchObject({
      success: false,
      error: 'A generation is already in progress for this project',
      code: 'CONFLICT',
      runId: 'run_1',
    });
    expect(body.requestId).toBeTypeOf('string');
  });

  it('forwards ApiError headers such as Retry-After', async () => {
    const handler = apiRoute('test.limited', async () => {
      throw new ApiError('RATE_LIMITED', 'slow down', { headers: { 'Retry-After': '30' } });
    });

    const res = await handler(request(), ctx({}));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('maps AuthSessionError statuses to auth codes', async () => {
    const unauthenticated = apiRoute('test.auth', async () => {
      throw new AuthSessionError('Authentication required', 401);
    });
    const res = await unauthenticated(request(), ctx({}));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('UNAUTHENTICATED');
  });

  it('maps ZodError to a 400 validation failure', async () => {
    const handler = apiRoute('test.zod', async () => {
      z.object({ name: z.string() }).parse({});
      return Response.json({});
    });
    const res = await handler(request(), ctx({}));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details.fieldErrors.name).toBeDefined();
  });

  it('hides internal error messages behind the fallback message', async () => {
    const handler = apiRoute(
      'test.crash',
      async () => {
        throw new Error('connection string postgres://user:secret@host leaked');
      },
      { fallbackError: 'Failed to do the thing' }
    );

    const res = await handler(request(), ctx({}));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to do the thing');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('keeps 404 semantics for notFound helpers', async () => {
    const handler = apiRoute('test.404', async () => {
      throw notFound('Project not found');
    });
    const res = await handler(request(), ctx({}));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Project not found');
  });
});

describe('readJsonBody', () => {
  it('parses valid JSON and returns null for an empty body', async () => {
    expect(await readJsonBody(request({ body: '{"a":1}' }))).toEqual({ a: 1 });
    expect(await readJsonBody(request({ body: '' }))).toBeNull();
  });

  it('rejects malformed JSON with a 400 instead of a 500', async () => {
    await expect(readJsonBody(request({ body: '{not json' }))).rejects.toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
    });
  });

  it('rejects oversized payloads with a 413', async () => {
    const body = JSON.stringify({ blob: 'x'.repeat(2_000) });
    await expect(readJsonBody(request({ body }), { maxBytes: 1_000 })).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });
});
