import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiRequest, ApiClientError, describeError, fileNameFromDisposition } from '@/lib/api/client';
import { formatRelativeTime, exportFileName } from '@/lib/format';

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(text, { status, headers })));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('returns the success envelope', async () => {
    respond(200, { success: true, projects: [{ id: 'p1' }] });
    await expect(apiRequest<{ projects: { id: string }[] }>('/api/v1/projects')).resolves.toMatchObject({
      projects: [{ id: 'p1' }],
    });
  });

  it('sends JSON bodies with the content type', async () => {
    respond(201, { success: true, project: { id: 'p2' } });
    await apiRequest('/api/v1/projects', { method: 'POST', json: { name: 'A', description: 'B' } });

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ name: 'A', description: 'B' });
  });

  it('turns the error envelope into an ApiClientError with status, code and request id', async () => {
    respond(429, { success: false, error: 'Too many requests. Please retry later.', code: 'RATE_LIMITED', requestId: 'req-123' });
    const err = await apiRequest('/api/v1/projects/p1/generate', { method: 'POST' }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 429, code: 'RATE_LIMITED', requestId: 'req-123', message: 'Too many requests. Please retry later.' });
  });

  it('flags unauthenticated responses', async () => {
    respond(401, { success: false, error: 'Authentication required', code: 'UNAUTHENTICATED' });
    const err = (await apiRequest('/api/v1/projects').catch((e) => e)) as ApiClientError;
    expect(err.isUnauthenticated).toBe(true);
  });

  it('treats success:false on a 200 as a failure', async () => {
    respond(200, { success: false, error: 'Nope' });
    await expect(apiRequest('/x')).rejects.toMatchObject({ message: 'Nope' });
  });

  it('survives a non-JSON error page, reading the request id from the header', async () => {
    respond(502, '<html>Bad gateway</html>', { 'x-request-id': 'edge-9' });
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 502, code: 'HTTP_502', requestId: 'edge-9' });
  });

  it('reports a network failure as NETWORK_ERROR instead of a raw TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});

describe('describeError', () => {
  it('adds the reference only to server failures', () => {
    expect(describeError(new ApiClientError('Failed to export', 500, 'INTERNAL_ERROR', 'r1'))).toBe('Failed to export (reference r1)');
    expect(describeError(new ApiClientError('Project not found', 404, 'NOT_FOUND', 'r2'))).toBe('Project not found');
  });

  it('never shows the text of unknown errors', () => {
    expect(describeError(new Error('TypeError: cannot read x of undefined'), 'Try again')).toBe('Try again');
  });
});

describe('fileNameFromDisposition', () => {
  it('prefers the UTF-8 form, falls back to the quoted name, and handles absence', () => {
    expect(fileNameFromDisposition(`attachment; filename="caf_.zip"; filename*=UTF-8''caf%C3%A9.zip`)).toBe('café.zip');
    expect(fileNameFromDisposition('attachment; filename="taskflow-v4.zip"')).toBe('taskflow-v4.zip');
    expect(fileNameFromDisposition(null)).toBeNull();
  });
});

describe('format helpers', () => {
  const now = new Date('2026-11-13T12:00:00Z');

  it('formats relative times at each threshold', () => {
    expect(formatRelativeTime('2026-11-13T11:59:30Z', now)).toBe('Just now');
    expect(formatRelativeTime('2026-11-13T11:55:00Z', now)).toBe('5m ago');
    expect(formatRelativeTime('2026-11-13T09:00:00Z', now)).toBe('3h ago');
    expect(formatRelativeTime('2026-11-11T12:00:00Z', now)).toBe('2d ago');
  });

  it('builds a safe fallback export name', () => {
    expect(exportFileName('TaskFlow Kanban!')).toBe('taskflow-kanban-source.zip');
    expect(exportFileName('***')).toBe('project-source.zip');
  });
});
