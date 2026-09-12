import { describe, it, expect, afterEach } from 'vitest';
import {
  getModelProvider,
  FixtureModelProvider,
  DeterministicModelProvider,
  GeminiModelProvider,
} from '@/modules/ai/model-provider';
import { DEVOPS_PULSE_FIXTURE } from '@/modules/ai/fixtures/saas-landing-fixture';
import { TASKFLOW_KANBAN_FIXTURE } from '@/modules/ai/fixtures/taskflow-kanban-fixture';
import { GenerateRequestSchema } from '@/types';
import type { ApplicationPlan, ProjectSpecification } from '@/types';

function createDummyPlan(name: string, description: string, scenarioId?: string): { plan: ApplicationPlan; spec: ProjectSpecification } {
  const spec: ProjectSpecification = {
    id: scenarioId || 'spec_test_1',
    projectId: 'proj_test',
    name,
    description,
    targetUsers: ['Users'],
    routes: [{ path: '/', name: 'Home', description: 'Home page' }],
    features: [{ id: 'f1', name: 'Core', description: 'Core feature', category: 'core', status: 'planned' }],
    dataEntities: [],
    integrations: [],
    designSystem: { theme: 'dark', primaryColor: '#6366f1', style: 'modern-minimal', typography: 'Inter' },
    technicalConstraints: ['Next.js App Router'],
    acceptanceCriteria: ['Valid build'],
    versionNumber: 1,
    schemaVersion: '1.0.0',
    createdAt: new Date().toISOString(),
  };

  const plan: ApplicationPlan = {
    projectId: 'proj_test',
    specification: spec,
    routes: [{ path: '/', name: 'Home', description: 'Home page' }],
    majorComponents: [{ name: 'Page', file: 'src/app/page.tsx', responsibility: 'Page', stateManagement: 'local' }],
    dataModel: { entities: [], storageStrategy: 'localStorage', notes: 'Browser' },
    userInteractions: ['Click button'],
    requiredServices: ['storage'],
    dependencies: { next: '^16.4.3', react: '^19.3.0', 'react-dom': '^19.3.0' },
    validationSteps: ['Build'],
    assumptions: [],
    unresolvedQuestions: [],
    createdAt: new Date().toISOString(),
  };

  return { plan, spec };
}

describe('FixtureModelProvider', () => {
  it('generates DevOps Pulse fixture when requested by scenario bench_01_saas_landing', async () => {
    const provider = new FixtureModelProvider();
    const { plan, spec } = createDummyPlan('DevOps Pulse', 'Kubernetes SaaS', 'bench_01_saas_landing');

    const logs: string[] = [];
    const result = await provider.generateProject(plan, spec, {
      onLog: (msg) => {
        logs.push(msg);
      },
    });

    expect(result.success).toBe(true);
    expect(result.modelProvider).toBe('fixture');
    expect(result.modelIdentifier).toBe(DEVOPS_PULSE_FIXTURE.id);
    expect(result.fallbackUsed).toBe(false);
    expect(result.files.length).toBe(DEVOPS_PULSE_FIXTURE.files.length);
    expect(result.usageMetadata?.totalTokens).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes(DEVOPS_PULSE_FIXTURE.name))).toBe(true);
  });

  it('generates TaskFlow Kanban fixture when keywords indicate a Kanban application', async () => {
    const provider = new FixtureModelProvider();
    const { plan, spec } = createDummyPlan('TaskFlow Kanban App', 'Interactive task management with kanban boards');

    const result = await provider.generateProject(plan, spec);

    expect(result.success).toBe(true);
    expect(result.modelProvider).toBe('fixture');
    expect(result.modelIdentifier).toBe(TASKFLOW_KANBAN_FIXTURE.id);
    expect(result.files.some((f) => f.path === 'src/lib/storage.ts')).toBe(true);
    expect(result.files.some((f) => f.content.includes('TaskFlow Kanban'))).toBe(true);
  });

  it('selects explicit fixture by fixtureId', async () => {
    const provider = new FixtureModelProvider();
    const { plan, spec } = createDummyPlan('Generic App', 'Some app');

    const result = await provider.generateProject(plan, spec, {
      fixtureId: 'fixture_repairable_syntax',
    });

    expect(result.success).toBe(true);
    expect(result.modelIdentifier).toBe('fixture_repairable_syntax');
    expect(result.files.some((f) => f.content.includes('</broken_unclosed_tag>'))).toBe(true);
  });

  it('respects AbortSignal cancellation', async () => {
    const provider = new FixtureModelProvider();
    const { plan, spec } = createDummyPlan('App', 'App');
    const controller = new AbortController();
    controller.abort();

    await expect(provider.generateProject(plan, spec, { signal: controller.signal })).rejects.toThrow();
  });

  it('replays modification properly with fixture metadata', async () => {
    const provider = new FixtureModelProvider();
    const baseFiles = [
      {
        path: 'src/app/page.tsx',
        responsibility: 'Main page',
        fileType: 'page' as const,
        content: 'export default function Page() { return <h1>Original</h1>; }',
        sizeBytes: 60,
        mimeType: 'text/typescript',
      },
    ];

    const result = await provider.modifyProject(baseFiles, 'Update headline to Hello World');
    expect(result.success).toBe(true);
    expect(result.modelProvider).toBe('fixture');
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.usageMetadata?.tokens).toBeGreaterThan(0);
  });
});

describe('getModelProvider Factory', () => {
  const origEnv = process.env.SHIPSHAPE_MODEL_PROVIDER;

  afterEach(() => {
    process.env.SHIPSHAPE_MODEL_PROVIDER = origEnv;
  });

  it('returns FixtureModelProvider when explicitly requested', () => {
    const provider = getModelProvider('fixture');
    expect(provider).toBeInstanceOf(FixtureModelProvider);
    expect(provider.providerType).toBe('fixture');
  });

  it('returns FixtureModelProvider when SHIPSHAPE_MODEL_PROVIDER=fixture', () => {
    process.env.SHIPSHAPE_MODEL_PROVIDER = 'fixture';
    const provider = getModelProvider();
    expect(provider).toBeInstanceOf(FixtureModelProvider);
  });

  it('returns DeterministicModelProvider when deterministic requested', () => {
    const provider = getModelProvider('deterministic');
    expect(provider).toBeInstanceOf(DeterministicModelProvider);
    expect(provider.providerType).toBe('deterministic');
  });

  it('returns GeminiModelProvider when gemini requested', () => {
    const provider = getModelProvider('gemini');
    expect(provider).toBeInstanceOf(GeminiModelProvider);
    expect(provider.providerType).toBe('gemini');
  });
});

describe('GenerateRequestSchema validation', () => {
  it('accepts fixture modelProvider and fixtureId', () => {
    const parsed = GenerateRequestSchema.safeParse({
      prompt: 'Build a Kanban board',
      modelProvider: 'fixture',
      fixtureId: 'fixture_taskflow_kanban_v1',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.modelProvider).toBe('fixture');
      expect(parsed.data.fixtureId).toBe('fixture_taskflow_kanban_v1');
    }
  });
});
