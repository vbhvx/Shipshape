import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider, isGeminiConfigured } from '@/modules/ai/gemini-provider';
import { ApplicationPlan, GeneratedFile } from '@/types';

function createTestPlan(name: string, description: string): ApplicationPlan {
  return {
    projectId: 'proj_test_gemini',
    specification: {
      id: 'spec_1',
      projectId: 'proj_test_gemini',
      name,
      description,
      targetUsers: ['Developers', 'Product Teams'],
      routes: [
        { path: '/', name: 'Dashboard', description: 'Overview dashboard' },
        { path: '/explore', name: 'Data Explorer', description: 'Table view' },
      ],
      features: [
        { id: 'f1', name: 'Item Tracking', description: 'Track items with status', category: 'core', status: 'planned' },
        { id: 'f2', name: 'Export', description: 'Export to CSV', category: 'ui', status: 'planned' },
      ],
      dataEntities: [
        {
          name: 'WorkItem',
          description: 'A trackable item',
          fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'title', type: 'string', required: true },
            { name: 'status', type: 'string', required: true },
          ],
        },
      ],
      integrations: [],
      designSystem: {
        theme: 'dark',
        primaryColor: '#6366f1',
        style: 'modern-minimal',
        typography: 'Inter',
      },
      technicalConstraints: ['Use Next.js 14 App Router', 'Tailwind CSS'],
      acceptanceCriteria: ['Must render cleanly without hydration mismatch'],
      versionNumber: 1,
      schemaVersion: '1.0.0',
      createdAt: new Date().toISOString(),
    },
    routes: [
      { path: '/', name: 'Dashboard', description: 'Overview dashboard' },
      { path: '/explore', name: 'Data Explorer', description: 'Table view' },
    ],
    majorComponents: [
      { name: 'HeaderNav', file: 'src/components/HeaderNav.tsx', responsibility: 'Nav bar', stateManagement: 'local' },
    ],
    dataModel: {
      entities: [],
      storageStrategy: 'localStorage',
      notes: 'Browser persistence',
    },
    userInteractions: ['Create item', 'Toggle status', 'Export CSV'],
    requiredServices: ['local-storage'],
    dependencies: {
      next: '^16.4.3',
      react: '^19.0.0',
      lucide_react: '^0.359.0',
    },
    validationSteps: ['Build check', 'Lint check'],
    assumptions: ['Client-only storage'],
    unresolvedQuestions: [],
    createdAt: new Date().toISOString(),
  };
}

describe('GeminiProvider', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
  });

  it('correctly detects if Gemini is configured via environment variable', () => {
    delete process.env.GEMINI_API_KEY;
    expect(isGeminiConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = '   ';
    expect(isGeminiConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = 'valid-test-key-12345';
    expect(isGeminiConfigured()).toBe(true);
  });

  it('falls back cleanly to deterministic generator when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const mockPlan = createTestPlan('Task Tracker', 'Simple task manager');
    const logs: string[] = [];

    const result = await GeminiProvider.generateProject(
      mockPlan,
      mockPlan.specification,
      async (msg) => { logs.push(msg); }
    );

    expect(result.success).toBe(true);
    expect(result.modelProvider).toBe('deterministic');
    expect(result.modelIdentifier).toBe('deterministic-engine-v1');
    expect(result.fallbackUsed).toBe(false);
    expect(result.files.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes('GEMINI_API_KEY not configured'))).toBe(true);
  });

  it('parses structured Gemini responses and backfills core manifest files', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: 'Next.js Task Manager App',
                  files: [
                    {
                      path: 'src/app/page.tsx',
                      responsibility: 'Task Manager Dashboard',
                      fileType: 'page',
                      content: 'export default function Page() { return <div>Task Dashboard</div>; }',
                    },
                    {
                      path: 'src/components/TaskCard.tsx',
                      responsibility: 'Task Card Component',
                      fileType: 'component',
                      content: 'export function TaskCard() { return <div>Task</div>; }',
                    },
                  ],
                }),
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 150,
        candidatesTokenCount: 220,
        totalTokenCount: 370,
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const mockPlan = createTestPlan('Task Manager', 'Task app');
    const logs: string[] = [];

    const result = await GeminiProvider.generateProject(
      mockPlan,
      mockPlan.specification,
      async (msg) => { logs.push(msg); }
    );

    expect(result.success).toBe(true);
    expect(result.modelProvider).toBe('gemini');
    expect(result.summary).toBe('Next.js Task Manager App');
    expect(result.usageMetadata?.totalTokens).toBe(370);
    expect(result.usageMetadata?.filesCount).toBeGreaterThanOrEqual(2);
    expect(result.fallbackUsed).toBe(false);

    // Verify backfilled essential files exist
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('package.json');
    expect(paths).toContain('src/app/layout.tsx');
    expect(paths).toContain('src/app/page.tsx');
    expect(paths).toContain('src/components/TaskCard.tsx');
  });

  it('handles API quota exhaustion with honest error code and deterministic fallback', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota).',
          status: 'RESOURCE_EXHAUSTED',
        },
      }),
      text: async () => JSON.stringify({
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota).',
          status: 'RESOURCE_EXHAUSTED',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const mockPlan = createTestPlan('CRM System', 'CRM app');
    const logs: string[] = [];

    const result = await GeminiProvider.generateProject(
      mockPlan,
      mockPlan.specification,
      async (msg) => { logs.push(msg); }
    );

    expect(result.success).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.errorCode).toBe('GEMINI_QUOTA_EXCEEDED');
    expect(result.modelProvider).toBe('deterministic');
    expect(result.files.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes('GEMINI_QUOTA_EXCEEDED'))).toBe(true);
  });

  it('modifies project files using Gemini structured responses', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const baseFiles: GeneratedFile[] = [
      {
        path: 'src/app/page.tsx',
        content: 'export default function Page() { return <div>Original</div>; }',
        sizeBytes: 60,
        fileType: 'page',
        responsibility: 'Home page',
        mimeType: 'text/typescript-jsx',
      },
      {
        path: 'package.json',
        content: '{"name": "test-app"}',
        sizeBytes: 21,
        fileType: 'config',
        responsibility: 'Config',
        mimeType: 'application/json',
      },
    ];

    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: 'Added Dark Mode toggle',
                  files: [
                    {
                      path: 'src/app/page.tsx',
                      responsibility: 'Updated Home Page with Dark Mode',
                      fileType: 'page',
                      content: 'export default function Page() { return <div>Dark Mode Active</div>; }',
                    },
                  ],
                }),
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 120,
        totalTokenCount: 220,
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const logs: string[] = [];
    const result = await GeminiProvider.modifyProject(
      baseFiles,
      'Add dark mode toggle',
      null,
      async (msg) => { logs.push(msg); }
    );

    expect(result.success).toBe(true);
    expect(result.modelProvider).toBe('gemini');
    expect(result.summary).toBe('Added Dark Mode toggle');
    const updatedPage = result.files.find((f) => f.path === 'src/app/page.tsx');
    expect(updatedPage?.content).toContain('Dark Mode Active');
    expect(updatedPage?.isModified).toBe(true);
    expect(result.files.find((f) => f.path === 'package.json')).toBeDefined();
  });

  it('handles 403 invalid key or permission denied with fast fallback and no retries', async () => {
    process.env.GEMINI_API_KEY = 'invalid-key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({
        error: {
          code: 403,
          message: 'Method does not allow unregistered callers.',
          status: 'PERMISSION_DENIED',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const mockPlan = createTestPlan('Todo App', 'A todo application');
    const logs: string[] = [];

    const result = await GeminiProvider.generateProject(
      mockPlan,
      mockPlan.specification,
      async (msg) => { logs.push(msg); }
    );

    // Assert that fetch was called exactly once on primary model, never retrying 403
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.errorCode).toBe('GEMINI_INVALID_KEY');
    expect(result.modelProvider).toBe('deterministic');
    expect(result.files.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes('GEMINI_INVALID_KEY'))).toBe(true);
  });

  it('handles 404 deprecated model with immediate fallback without secondary retry loop', async () => {
    process.env.GEMINI_API_KEY = 'valid-key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        error: {
          code: 404,
          message: 'This model is no longer available.',
          status: 'NOT_FOUND',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const mockPlan = createTestPlan('Todo App', 'A todo app');
    const logs: string[] = [];

    const result = await GeminiProvider.generateProject(
      mockPlan,
      mockPlan.specification,
      async (msg) => { logs.push(msg); }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.errorCode).toBe('GEMINI_MODEL_UNAVAILABLE');
    expect(result.modelProvider).toBe('deterministic');
  });
});
