import { describe, it, expect, vi, afterEach } from 'vitest';
import { runGeminiPreflight } from '@/modules/ai/gemini-preflight';
import {
  ExperimentRequestAccountant,
  BudgetExceededError,
  type RequestBudgetConfig,
} from '@/modules/ai/request-budget';
import { GeminiProvider } from '@/modules/ai/gemini-provider';

describe('Gemini Live Preflight Probe', () => {
  const origKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    process.env.GEMINI_API_KEY = origKey;
    vi.restoreAllMocks();
  });

  it('returns NOT_CONFIGURED when GEMINI_API_KEY is missing or placeholder', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await runGeminiPreflight();
    expect(res.ready).toBe(false);
    expect(res.status).toBe('NOT_CONFIGURED');
    expect(res.errorCode).toBe('GEMINI_KEY_MISSING');
  });

  it('correctly categorizes HTTP 200 response as READY with real token usage', async () => {
    process.env.GEMINI_API_KEY = 'valid-test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'PONG' }] } }],
          usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 1, totalTokenCount: 7 },
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await runGeminiPreflight('gemini-3.6-flash');
    expect(res.ready).toBe(true);
    expect(res.status).toBe('READY');
    expect(res.rawResponse).toBe('PONG');
    expect(res.usageMetadata?.totalTokens).toBe(7);
    expect(res.usageMetadata?.isSyntheticTokenCount).toBe(false);
  });

  it('correctly categorizes HTTP 429 as QUOTA_EXHAUSTED and extracts retry duration', async () => {
    process.env.GEMINI_API_KEY = 'valid-test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () =>
        JSON.stringify({
          error: {
            message:
              'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20. Please retry in 12h30m.',
          },
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await runGeminiPreflight('gemini-3.6-flash');
    expect(res.ready).toBe(false);
    expect(res.status).toBe('QUOTA_EXHAUSTED');
    expect(res.errorCode).toBe('GEMINI_QUOTA_EXCEEDED');
    expect(res.retryAfter).toBe('12h30m.');
  });

  it('correctly categorizes HTTP 401 as AUTH_ERROR', async () => {
    process.env.GEMINI_API_KEY = 'invalid-test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'API key not valid' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await runGeminiPreflight('gemini-3.6-flash');
    expect(res.ready).toBe(false);
    expect(res.status).toBe('AUTH_ERROR');
    expect(res.errorCode).toBe('GEMINI_AUTH_FAILED');
  });

  it('accounts for preflight probe in ExperimentRequestAccountant', async () => {
    process.env.GEMINI_API_KEY = 'valid-test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'PONG' }] } }],
          usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 1, totalTokenCount: 7 },
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const accountant = new ExperimentRequestAccountant({
      maxTotalRequests: 5,
      maxPreflightRequests: 1,
      maxGenerationRequests: 2,
      maxModificationRequests: 1,
      maxRepairRequests: 1,
    });

    const res = await runGeminiPreflight('gemini-3.6-flash', 5000, accountant);
    expect(res.ready).toBe(true);

    const summary = accountant.getSummary();
    expect(summary.totalRequests).toBe(1);
    expect(summary.preflightRequests).toBe(1);
    expect(summary.tokenTotals.totalTokens).toBe(7);

    // Second preflight should be blocked by budget
    await expect(runGeminiPreflight('gemini-3.6-flash', 5000, accountant)).rejects.toThrow(
      BudgetExceededError
    );
  });
});

describe('ExperimentRequestAccountant & HTTP Boundary Tracking', () => {
  const origKey = process.env.GEMINI_API_KEY;
  const config: RequestBudgetConfig = {
    maxTotalRequests: 6,
    maxPreflightRequests: 2,
    maxGenerationRequests: 2,
    maxModificationRequests: 1,
    maxRepairRequests: 1,
  };

  afterEach(() => {
    process.env.GEMINI_API_KEY = origKey;
    vi.restoreAllMocks();
  });

  it('tracks requests and enforces operational limits', () => {
    const accountant = new ExperimentRequestAccountant(config);

    expect(accountant.canIssueRequest('generation')).toBe(true);

    accountant.recordRequest({
      type: 'generation',
      durationMs: 1200,
      success: true,
      model: 'gemini-3.6-flash',
      tokens: { promptTokens: 500, candidatesTokens: 2000, totalTokens: 2500 },
    });

    accountant.recordRequest({
      type: 'generation',
      durationMs: 1100,
      success: true,
      model: 'gemini-3.6-flash',
      tokens: { promptTokens: 500, candidatesTokens: 2000, totalTokens: 2500 },
    });

    // Max 2 generation requests reached
    expect(accountant.canIssueRequest('generation')).toBe(false);
    expect(() => accountant.assertBudgetAvailable('generation')).toThrow(BudgetExceededError);

    // Modification still allowed
    expect(accountant.canIssueRequest('modification')).toBe(true);

    const summary = accountant.getSummary();
    expect(summary.totalRequests).toBe(2);
    expect(summary.generationRequests).toBe(2);
    expect(summary.successfulRequests).toBe(2);
    expect(summary.tokenTotals.totalTokens).toBe(5000);
  });

  it('intercepts and accounts for GeminiProvider HTTP requests at the boundary', async () => {
    process.env.GEMINI_API_KEY = 'valid-test-key';
    const mockFilesResponse = {
      summary: 'Generated App',
      files: [
        {
          path: 'src/app/page.tsx',
          responsibility: 'Main view',
          fileType: 'page',
          content: "'use client';\nexport default function Page() { return <div>Test</div>; }",
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockFilesResponse) }] } }],
        usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 400, totalTokenCount: 1600 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const accountant = new ExperimentRequestAccountant(config);

    const plan: any = {
      routes: [{ path: '/', name: 'Home' }],
      specification: { name: 'App', features: [] },
    };

    const result = await GeminiProvider.generateProject(plan, plan.specification, undefined, undefined, accountant);

    expect(result.success).toBe(true);
    expect(result.modelProvider).toBe('gemini');

    const summary = accountant.getSummary();
    expect(summary.totalRequests).toBe(1);
    expect(summary.generationRequests).toBe(1);
    expect(summary.tokenTotals.totalTokens).toBe(1600);
  });

  it('accounts for repair requests under the repair category limit', async () => {
    process.env.GEMINI_API_KEY = 'valid-test-key';
    const mockRepairResponse = {
      summary: 'Repaired Widget',
      files: [
        {
          path: 'src/components/DiagnosticWidget.tsx',
          responsibility: 'Repaired component',
          fileType: 'component',
          content: "'use client';\nexport function DiagnosticWidget() { return <div>Fixed</div>; }",
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockRepairResponse) }] } }],
        usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 200, totalTokenCount: 1000 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const accountant = new ExperimentRequestAccountant(config);

    const result = await GeminiProvider.modifyProject(
      [],
      'Fix syntax',
      null,
      undefined,
      undefined,
      accountant,
      'repair'
    );

    expect(result.success).toBe(true);
    const summary = accountant.getSummary();
    expect(summary.totalRequests).toBe(1);
    expect(summary.repairRequests).toBe(1);
    expect(summary.modificationRequests).toBe(0);
    expect(summary.tokenTotals.totalTokens).toBe(1000);
  });

  it('prevents concurrent in-flight requests from bypassing budget limits', () => {
    const tightAccountant = new ExperimentRequestAccountant({
      maxTotalRequests: 2,
      maxPreflightRequests: 1,
      maxGenerationRequests: 1,
      maxModificationRequests: 0,
      maxRepairRequests: 0,
    });

    // Acquire first reservation
    const release1 = tightAccountant.acquireReservation('generation');
    expect(tightAccountant.canIssueRequest('generation')).toBe(false);

    // Second concurrent acquisition must throw BudgetExceededError immediately
    expect(() => tightAccountant.acquireReservation('generation')).toThrow(BudgetExceededError);

    // Release reservation without committing
    release1();
    expect(tightAccountant.canIssueRequest('generation')).toBe(true);

    // Now acquisition succeeds
    const release2 = tightAccountant.acquireReservation('generation');
    tightAccountant.recordRequest({
      type: 'generation',
      durationMs: 500,
      success: true,
      model: 'gemini-3.6-flash',
      tokens: { promptTokens: 100, candidatesTokens: 200, totalTokens: 300 },
    });
    release2(); // safe no-op

    // Limit reached after recording
    expect(tightAccountant.canIssueRequest('generation')).toBe(false);
    expect(() => tightAccountant.acquireReservation('generation')).toThrow(BudgetExceededError);
  });

  it('preserves exact HTTP 503 status and sanitized upstream message in GeminiProviderResult', async () => {
    process.env.GEMINI_API_KEY = 'valid-test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () =>
        JSON.stringify({
          error: {
            message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
            status: 'UNAVAILABLE',
          },
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const plan: any = { routes: [{ path: '/' }], specification: { name: 'App' } };
    const res = await GeminiProvider.generateProject(plan, plan.specification);

    expect(res.rawHttpStatus).toBe(503);
    expect(res.errorCode).toBe('GEMINI_INFERENCE_ERROR');
    expect(res.error).toContain('high demand');
    expect(res.fallbackUsed).toBe(true);
    expect(res.modelProvider).toBe('deterministic');
  });

  it('handles malformed or non-JSON HTML upstream error responses safely without crashing', async () => {
    process.env.GEMINI_API_KEY = 'valid-test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '<html><body>502 Bad Gateway: Proxy Error</body></html>',
    });
    vi.stubGlobal('fetch', mockFetch);

    const plan: any = { routes: [{ path: '/' }], specification: { name: 'App' } };
    const res = await GeminiProvider.generateProject(plan, plan.specification);

    expect(res.rawHttpStatus).toBe(502);
    expect(res.errorCode).toBe('GEMINI_INFERENCE_ERROR');
    expect(res.error).toContain('502 Bad Gateway');
    expect(res.fallbackUsed).toBe(true);
  });

  it('ensures missing diagnostic fields do not break failure reporting or masquerade as success', async () => {
    process.env.GEMINI_API_KEY = 'valid-test-key';
    const mockFetch = vi.fn().mockRejectedValue(new Error('Low-level socket hang up'));
    vi.stubGlobal('fetch', mockFetch);

    const plan: any = { routes: [{ path: '/' }], specification: { name: 'App' } };
    const res = await GeminiProvider.generateProject(plan, plan.specification);

    expect(res.fallbackUsed).toBe(true);
    expect(res.modelProvider).toBe('deterministic');
    expect(res.error).toBe('Low-level socket hang up');
    // Strict caller invariant: fallbackUsed must never count as live success
    const isLiveSuccess = res.success && !res.fallbackUsed && res.modelProvider === 'gemini';
    expect(isLiveSuccess).toBe(false);
  });
});
