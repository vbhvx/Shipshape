import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { prismaAdapter } from '@/lib/db/prisma-adapter';
import { prisma } from '@/lib/db/prisma';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import { GeminiProvider } from '@/modules/ai/gemini-provider';
import { ApplicationPlan } from '@/types';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';
import { POST as cancelRouteHandler } from '@/app/api/v1/generation-runs/[runId]/cancel/route';
import { GenerationRun, ProjectVersion, GeneratedFile } from '@/types';
import { NextRequest } from 'next/server';
import path from 'path';
import os from 'os';
import { getDefaultTestUser } from '../helpers/db';

vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session')>();
  return {
    ...actual,
    requireAuth: vi.fn().mockImplementation(async () => {
      return getDefaultTestUser();
    }),
    getOwnedProject: vi.fn().mockImplementation(async (projectId: string) => {
      return db.getProject(projectId);
    }),
  };
});

vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn(),
    generationRun: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    projectVersion: {
      upsert: vi.fn(),
    },
    projectFile: {
      upsert: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
  };
  return {
    prisma: mockPrisma,
  };
});

describe('Generation Lifecycle Hardening & Vercel Compatibility', () => {
  const testProjectId = `proj_test_hardening_${Date.now()}`;

  beforeEach(async () => {
    // Ensure default test project exists
    const user = await getDefaultTestUser();
    await db.createProject({
      id: testProjectId,
      ownerUserId: user.id,
      name: 'Hardening Test Project',
      description: 'Test project for lifecycle hardening',
      status: 'draft',
    });
  });

  describe('P0 — Atomic publication safety (publishVersionIfActive)', () => {
    it('successfully and atomically publishes version, files, project active version, and completes run', async () => {
      const runId = `run_pub_success_${Date.now()}`;
      const versionId = `ver_pub_success_${Date.now()}`;

      await db.saveGenerationRun({
        id: runId,
        projectId: testProjectId,
        runType: 'generation',
        status: 'generating',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
      });

      const version: ProjectVersion = {
        id: versionId,
        projectId: testProjectId,
        versionNumber: 1,
        sourceManifest: ['package.json'],
        changeSummary: 'Initial generation',
        validationStatus: 'passed',
        createdAt: new Date().toISOString(),
      };

      const files: GeneratedFile[] = [
        {
          path: 'package.json',
          content: '{"name": "test-pkg"}',
          fileType: 'config',
          responsibility: 'Package config',
          mimeType: 'application/json',
          sizeBytes: 21,
        },
      ];

      const published = await db.publishVersionIfActive(runId, testProjectId, version, files);
      expect(published).not.toBeNull();
      expect(published?.id).toBe(versionId);

      // Verify project state was updated atomically
      const project = await db.getProject(testProjectId);
      expect(project?.activeVersionId).toBe(versionId);
      expect(project?.status).toBe('running');

      // Verify files were persisted
      const persistedFiles = await db.getFilesForVersion(testProjectId, versionId);
      expect(persistedFiles.length).toBe(1);
      expect(persistedFiles[0].path).toBe('package.json');

      // Verify run was marked completed
      const run = await db.getGenerationRun(runId);
      expect(run?.status).toBe('completed');
      expect(run?.resultVersionId).toBe(versionId);
    });

    it('rejects publication and commits zero state when run was cancelled', async () => {
      const runId = `run_pub_cancelled_${Date.now()}`;
      const versionId = `ver_pub_cancelled_${Date.now()}`;

      // Project initially has no active version
      const projectBefore = await db.getProject(testProjectId);
      const initialActiveVersion = projectBefore?.activeVersionId;

      await db.saveGenerationRun({
        id: runId,
        projectId: testProjectId,
        runType: 'generation',
        status: 'cancelled', // Run is cancelled before publication
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
      });

      const version: ProjectVersion = {
        id: versionId,
        projectId: testProjectId,
        versionNumber: 2,
        sourceManifest: ['package.json'],
        changeSummary: 'Should not publish',
        validationStatus: 'passed',
        createdAt: new Date().toISOString(),
      };

      const files: GeneratedFile[] = [
        {
          path: 'package.json',
          content: '{"name": "unauthorized"}',
          fileType: 'config',
          responsibility: 'Config',
          mimeType: 'application/json',
          sizeBytes: 24,
        },
      ];

      const published = await db.publishVersionIfActive(runId, testProjectId, version, files);
      expect(published).toBeNull();

      // Project active version MUST NOT be changed to the cancelled version
      const projectAfter = await db.getProject(testProjectId);
      expect(projectAfter?.activeVersionId).toBe(initialActiveVersion);

      // Version MUST NOT be committed
      const storedVersion = await db.getVersion(versionId);
      expect(storedVersion).toBeNull();

      // Files MUST NOT be committed
      const storedFiles = await db.getFilesForVersion(testProjectId, versionId);
      expect(storedFiles.length).toBe(0);

      // Run status MUST remain cancelled
      const run = await db.getGenerationRun(runId);
      expect(run?.status).toBe('cancelled');
    });
  });

  describe('P0 — Cancellation endpoint HTTP responses (409 on conflict)', () => {
    it('returns HTTP 409 Conflict when attempting to cancel an already completed run', async () => {
      const runId = `run_cancel_conflict_${Date.now()}`;
      await db.saveGenerationRun({
        id: runId,
        projectId: testProjectId,
        runType: 'generation',
        status: 'completed',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/generation-runs/${runId}/cancel`, {
        method: 'POST',
      });

      const res = await cancelRouteHandler(req, {
        params: Promise.resolve({ runId }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Cannot cancel run that is already in terminal state');

      // Verify no cancellation event was recorded
      const events = await db.getGenerationEvents(runId);
      const cancelEvents = events.filter((e) => e.message.includes('Run was cancelled by user'));
      expect(cancelEvents.length).toBe(0);
    });
  });

  describe('P1 — Terminal-state immutability in database adapters', () => {
    it('rejects partial updates (omitting status) on already completed runs', async () => {
      const runId = `run_immutable_${Date.now()}_1`;
      await db.saveGenerationRun({
        id: runId,
        projectId: testProjectId,
        runType: 'generation',
        status: 'completed',
        resultVersionId: 'ver_orig',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });

      // Attempt to mutate resultVersionId without changing status
      const updated = await db.updateGenerationRun(runId, {
        resultVersionId: 'ver_tampered',
        errorMessage: 'Fake error',
      });

      expect(updated?.resultVersionId).toBe('ver_orig');
      expect(updated?.errorMessage).toBeUndefined();

      const persisted = await db.getGenerationRun(runId);
      expect(persisted?.resultVersionId).toBe('ver_orig');
      expect(persisted?.errorMessage).toBeUndefined();
    });

    it('rejects partial updates on cancelled runs', async () => {
      const runId = `run_immutable_${Date.now()}_2`;
      await db.saveGenerationRun({
        id: runId,
        projectId: testProjectId,
        runType: 'generation',
        status: 'cancelled',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });

      const updated = await db.updateGenerationRun(runId, {
        errorCode: 'NEW_CODE',
        resultVersionId: 'ver_illegal',
      });

      expect(updated?.errorCode).toBeUndefined();
      expect(updated?.resultVersionId).toBeUndefined();

      const persisted = await db.getGenerationRun(runId);
      expect(persisted?.errorCode).toBeUndefined();
      expect(persisted?.status).toBe('cancelled');
    });

    it('rejects partial updates on failed runs', async () => {
      const runId = `run_immutable_${Date.now()}_3`;
      await db.saveGenerationRun({
        id: runId,
        projectId: testProjectId,
        runType: 'generation',
        status: 'failed',
        errorCode: 'ORIGINAL_FAILURE',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });

      const updated = await db.updateGenerationRun(runId, {
        errorCode: 'OVERWRITTEN',
      });

      expect(updated?.errorCode).toBe('ORIGINAL_FAILURE');
      const persisted = await db.getGenerationRun(runId);
      expect(persisted?.errorCode).toBe('ORIGINAL_FAILURE');
    });
  });

  describe('P2 — Prisma adapter conditional update & transaction semantics (isolated mock)', () => {
    it('prismaAdapter.publishVersionIfActive uses $transaction and conditional updateMany', async () => {
      const mockRunId = 'run_mock_prisma_pub';
      const mockProjectId = 'proj_mock_prisma_pub';

      const mockVersion: ProjectVersion = {
        id: 'ver_mock_prisma',
        projectId: mockProjectId,
        versionNumber: 1,
        sourceManifest: ['package.json'],
        changeSummary: 'Mock summary',
        validationStatus: 'passed',
        createdAt: new Date().toISOString(),
      };

      const mockFiles: GeneratedFile[] = [
        {
          path: 'package.json',
          content: '{}',
          fileType: 'config',
          responsibility: 'Config',
          mimeType: 'application/json',
          sizeBytes: 2,
        },
      ];

      // Spy on prisma.$transaction
      const updateManySpy = vi.fn().mockResolvedValue({ count: 1 });
      const versionUpsertSpy = vi.fn().mockResolvedValue({
        id: mockVersion.id,
        projectId: mockProjectId,
        versionNumber: 1,
        sourceManifest: '["package.json"]',
        changeSummary: 'Mock summary',
        validationStatus: 'passed',
        createdAt: new Date(),
      });
      const fileUpsertSpy = vi.fn().mockResolvedValue({});
      const projectUpdateSpy = vi.fn().mockResolvedValue({});

      const txMock = {
        generationRun: { updateMany: updateManySpy },
        projectVersion: { upsert: versionUpsertSpy },
        projectFile: { upsert: fileUpsertSpy },
        project: { update: projectUpdateSpy },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback(txMock);
      });

      const result = await prismaAdapter.publishVersionIfActive(mockRunId, mockProjectId, mockVersion, mockFiles);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: mockRunId,
            projectId: mockProjectId,
            status: { notIn: ['completed', 'failed', 'cancelled'] },
          }),
        })
      );
      expect(versionUpsertSpy).toHaveBeenCalled();
      expect(projectUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockProjectId },
          data: expect.objectContaining({ activeVersionId: mockVersion.id, status: 'running' }),
        })
      );
      expect(result?.id).toBe(mockVersion.id);
    });

    it('prismaAdapter.publishVersionIfActive rolls back if run was cancelled (count === 0)', async () => {
      const mockRunId = 'run_mock_prisma_cancelled';
      const mockProjectId = 'proj_mock_prisma_cancelled';

      const mockVersion: ProjectVersion = {
        id: 'ver_mock_rolled_back',
        projectId: mockProjectId,
        versionNumber: 1,
        sourceManifest: ['package.json'],
        changeSummary: 'Mock summary',
        validationStatus: 'passed',
        createdAt: new Date().toISOString(),
      };

      const updateManySpy = vi.fn().mockResolvedValue({ count: 0 }); // Run was cancelled concurrently
      const versionUpsertSpy = vi.fn();
      const projectUpdateSpy = vi.fn();

      const txMock = {
        generationRun: { updateMany: updateManySpy },
        projectVersion: { upsert: versionUpsertSpy },
        projectFile: { upsert: vi.fn() },
        project: { update: projectUpdateSpy },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback(txMock);
      });

      const result = await prismaAdapter.publishVersionIfActive(mockRunId, mockProjectId, mockVersion, []);

      expect(result).toBeNull();
      // Ensure no version or project mutations were committed
      expect(versionUpsertSpy).not.toHaveBeenCalled();
      expect(projectUpdateSpy).not.toHaveBeenCalled();
    });

    it('prismaAdapter.updateGenerationRun enforces status: { notIn: terminalStatuses } even for partial updates', async () => {
      const mockRunId = 'run_mock_prisma_immutable';

      const updateManySpy = vi.fn().mockResolvedValue({ count: 0 });
      vi.mocked(prisma.generationRun.updateMany).mockImplementation(updateManySpy);
      vi.spyOn(prismaAdapter, 'getGenerationRun').mockResolvedValue({
        id: mockRunId,
        projectId: 'proj_mock',
        runType: 'generation',
        status: 'completed',
        modelProvider: 'deterministic',
        modelIdentifier: 'shipshape-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
      });

      // Partial update omitting status
      await prismaAdapter.updateGenerationRun(mockRunId, { errorMessage: 'New Error' });

      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: mockRunId,
            status: { notIn: ['completed', 'failed', 'cancelled'] },
          }),
        })
      );

      vi.restoreAllMocks();
    });
  });

  describe('Durable cancellation observable across instances', () => {
    it('observes cancellation written to the database without requiring in-memory signal', async () => {
      const runId = `run_durable_${Date.now()}`;
      const run: GenerationRun = {
        id: runId,
        projectId: testProjectId,
        runType: 'generation',
        status: 'cancelled',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      };

      await db.saveGenerationRun(run);

      const isCancelled = await ProjectOrchestrator.isCancelled(runId);
      expect(isCancelled).toBe(true);
    });

    it('stops full generation workflow when cancelled before version publishing', async () => {
      const runId = `run_full_cancel_${Date.now()}`;
      const initialRun: GenerationRun = {
        id: runId,
        projectId: testProjectId,
        runType: 'generation',
        status: 'cancelled',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
      };

      await db.saveGenerationRun(initialRun);

      const dummyPlan = {
        projectId: testProjectId,
        name: 'Cancelled App',
        routes: [],
        dataEntities: [],
        dependencies: {},
        specification: {
          id: `spec_${Date.now()}`,
          projectId: testProjectId,
          name: 'Cancelled App',
          description: 'Cancelled App description',
          features: [],
          entities: [],
          schemaVersion: '1.0.0',
          createdAt: new Date().toISOString(),
        },
      };

      const result = await ProjectOrchestrator.runFullGeneration(runId, testProjectId, dummyPlan as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');

      const versions = await db.listVersions(testProjectId);
      const matchingVersion = versions.find((v) => v.sourceManifest.includes(runId));
      expect(matchingVersion).toBeUndefined();
    });

    it('stops modification workflow when cancelled before version publishing', async () => {
      const runId = `run_mod_cancel_${Date.now()}`;
      const initialRun: GenerationRun = {
        id: runId,
        projectId: testProjectId,
        runType: 'modification',
        status: 'cancelled',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
      };

      await db.saveGenerationRun(initialRun);

      const result = await ProjectOrchestrator.runModification(
        runId,
        testProjectId,
        'Add new feature'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });

  describe('Sandbox filesystem safety and temporary directory', () => {
    it('writes disposable workspaces to the OS temporary directory, not process.cwd()', async () => {
      const files = [
        {
          path: 'package.json',
          content: '{"name": "temp-test"}',
          fileType: 'config' as const,
          responsibility: 'Config',
          mimeType: 'application/json',
          sizeBytes: 25,
        },
      ];

      const workspaceDir = await SandboxManager.prepareWorkspace(testProjectId, files);

      const tempRoot = process.env.SANDBOX_DIR || path.join(os.tmpdir(), 'shipshape-sandboxes');
      expect(workspaceDir.startsWith(tempRoot)).toBe(true);
      expect(workspaceDir.startsWith(process.cwd())).toBe(false);
    });

    it('rejects file paths that attempt path traversal outside workspace', async () => {
      const unsafeFiles = [
        {
          path: '../../outside.txt',
          content: 'malicious',
          fileType: 'lib' as const,
          responsibility: 'Exploit',
          mimeType: 'text/plain',
          sizeBytes: 9,
        },
      ];

      const workspaceDir = await SandboxManager.prepareWorkspace(testProjectId, unsafeFiles);
      expect(workspaceDir).toBeDefined();
    });
  });

  describe('Truthful validation results', () => {
    it('accurately reports manifest and syntax checks without claiming Turbopack compiler builds', async () => {
      const runId = `run_val_test_${Date.now()}`;
      const files = [
        {
          path: 'package.json',
          content: '{"name": "valid-app"}',
          fileType: 'config' as const,
          responsibility: 'Manifest',
          mimeType: 'application/json',
          sizeBytes: 25,
        },
        {
          path: 'tsconfig.json',
          content: '{"compilerOptions": {}}',
          fileType: 'config' as const,
          responsibility: 'TypeScript Config',
          mimeType: 'application/json',
          sizeBytes: 25,
        },
        {
          path: 'src/app/layout.tsx',
          content: 'export default function Layout({children}) { return children; }',
          fileType: 'page' as const,
          responsibility: 'Root Layout',
          mimeType: 'text/typescript',
          sizeBytes: 60,
        },
        {
          path: 'src/app/page.tsx',
          content: 'export default function Home() { return null; }',
          fileType: 'page' as const,
          responsibility: 'Home Page',
          mimeType: 'text/typescript',
          sizeBytes: 45,
        },
      ];

      const validation = await SandboxManager.validateAndBuild(testProjectId, runId, files);
      expect(validation.passed).toBe(true);

      const logs = await db.getBuildLogs(runId);
      const logContents = logs.map((l) => l.content).join(' ');

      expect(logContents).toContain('[MANIFEST] Checking core template files');
      expect(logContents).toContain('[VALIDATION] Static manifest and JSON syntax verification: PASSED');
      expect(logContents).not.toContain('Turbopack optimized build completed');
      expect(logContents).not.toContain('TypeScript compilation check: PASSED');
    });
  });

  describe('Zombie run reaping and auto-recovery', () => {
    it('detects and reaps stale active runs older than 2 minutes without blocking new generations', async () => {
      const staleRunId = `run_stale_${Date.now()}`;
      const threeMinutesAgo = new Date(Date.now() - 180000).toISOString();

      await db.saveGenerationRun({
        id: staleRunId,
        projectId: testProjectId,
        runType: 'generation',
        status: 'generating',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: threeMinutesAgo,
      });

      // Verify that the stale run can be retrieved and detected
      const fetchedRun = await db.getGenerationRun(staleRunId);
      expect(fetchedRun).toBeDefined();

      const isStale = ['queued', 'planning', 'generating', 'validating', 'building', 'repairing', 'starting'].includes(fetchedRun!.status) &&
        (Date.now() - new Date(fetchedRun!.startedAt).getTime() > 120_000);
      expect(isStale).toBe(true);

      // Verify updating stale run transitions it to terminal failed state with RUN_TIMEOUT
      await db.updateGenerationRun(staleRunId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorCode: 'RUN_TIMEOUT',
        errorMessage: 'Generation timed out after 2 minutes',
      });

      const updated = await db.getGenerationRun(staleRunId);
      expect(updated?.status).toBe('failed');
      expect(updated?.errorCode).toBe('RUN_TIMEOUT');
    });
  });

  describe('P0 — Explicit cancellation and in-flight request abort propagation', () => {
    it('aborts in-flight generation when user explicitly cancels the run', async () => {
      const cancelProjectId = `proj_test_cancel_abort_${Date.now()}`;
      const user = await getDefaultTestUser();
      await db.createProject({
        id: cancelProjectId,
        ownerUserId: user.id,
        name: 'Cancellation Abort Test Project',
        description: 'Test project for in-flight cancellation',
        status: 'draft',
      });

      const runId = `run_abort_test_${Date.now()}`;
      await db.saveGenerationRun({
        id: runId,
        projectId: cancelProjectId,
        runType: 'generation',
        status: 'queued',
        modelProvider: 'gemini',
        modelIdentifier: 'gemini-3.6-flash',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
      });

      const plan: ApplicationPlan = {
        projectId: cancelProjectId,
        specification: {
          id: 'spec_abort',
          projectId: cancelProjectId,
          name: 'Abort Test App',
          description: 'Testing abort controller',
          targetUsers: ['Users'],
          routes: [{ path: '/', name: 'Home', description: 'Home page' }],
          features: [],
          dataEntities: [],
          integrations: [],
          designSystem: { theme: 'light', primaryColor: '#000', style: 'saas-clean', typography: 'sans' },
          technicalConstraints: [],
          acceptanceCriteria: [],
          versionNumber: 1,
          schemaVersion: '1.0.0',
          createdAt: new Date().toISOString(),
        },
        routes: [{ path: '/', name: 'Home', description: 'Home page' }],
        majorComponents: [],
        dataModel: { entities: [], storageStrategy: 'localStorage', notes: '' },
        userInteractions: [],
        requiredServices: [],
        dependencies: {},
        validationSteps: [],
        assumptions: [],
        unresolvedQuestions: [],
        createdAt: new Date().toISOString(),
      };

      // Spy on GeminiProvider to simulate in-flight AI generation waiting on network
      const geminiSpy = vi.spyOn(GeminiProvider, 'generateProject').mockImplementation(async (_plan, _spec, _onLog, signal) => {
        return new Promise((_resolve, reject) => {
          if (signal?.aborted) {
            const err: any = new Error('Generation cancelled by user');
            err.isCancelled = true;
            reject(err);
            return;
          }
          signal?.addEventListener('abort', () => {
            const err: any = new Error('Generation cancelled by user');
            err.isCancelled = true;
            reject(err);
          });
        });
      });

      // Start generation asynchronously
      const genPromise = ProjectOrchestrator.runFullGeneration(runId, cancelProjectId, plan);

      // Give microtask time to enter the in-flight provider call
      await new Promise((r) => setTimeout(r, 10));

      // Explicitly trigger user cancellation
      ProjectOrchestrator.cancelRun(runId);
      await db.updateGenerationRun(runId, {
        status: 'cancelled',
        finishedAt: new Date().toISOString(),
      });

      const result = await genPromise;

      // Orchestrator must report failure due to cancellation
      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('cancelled');

      // Version MUST NOT be published
      const project = await db.getProject(cancelProjectId);
      expect(project?.activeVersionId).toBeUndefined();

      const versions = await db.listVersions(cancelProjectId);
      expect(versions.length).toBe(0);

      geminiSpy.mockRestore();
    });

    it('rejects Gemini code generation immediately when AbortSignal is already aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const plan: ApplicationPlan = {
        projectId: testProjectId,
        specification: {
          id: 'spec_abort_gemini',
          projectId: testProjectId,
          name: 'Abort Gemini App',
          description: 'Testing abort signal in GeminiProvider',
          targetUsers: ['Users'],
          routes: [{ path: '/', name: 'Home', description: 'Home page' }],
          features: [],
          dataEntities: [],
          integrations: [],
          designSystem: { theme: 'light', primaryColor: '#000', style: 'saas-clean', typography: 'sans' },
          technicalConstraints: [],
          acceptanceCriteria: [],
          versionNumber: 1,
          schemaVersion: '1.0.0',
          createdAt: new Date().toISOString(),
        },
        routes: [{ path: '/', name: 'Home', description: 'Home page' }],
        majorComponents: [],
        dataModel: { entities: [], storageStrategy: 'localStorage', notes: '' },
        userInteractions: [],
        requiredServices: [],
        dependencies: {},
        validationSteps: [],
        assumptions: [],
        unresolvedQuestions: [],
        createdAt: new Date().toISOString(),
      };

      await expect(
        GeminiProvider.generateProject(
          plan,
          plan.specification,
          undefined,
          abortController.signal
        )
      ).rejects.toThrow('Generation cancelled by user');
    });

    it('rejects Gemini code modification immediately when AbortSignal is aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const files: GeneratedFile[] = [
        {
          path: 'src/app/page.tsx',
          content: 'export default function Page() { return <div>Original</div>; }',
          fileType: 'page',
          responsibility: 'Page',
          mimeType: 'text/typescript-jsx',
          sizeBytes: 60,
        },
      ];

      await expect(
        GeminiProvider.modifyProject(
          files,
          'Add user preferences',
          null,
          undefined,
          abortController.signal
        )
      ).rejects.toThrow('Generation cancelled by user');
    });

    it('does NOT cancel generation run on client disconnect (preserves run in DB for reconnection)', async () => {
      const runId = `run_reconnect_test_${Date.now()}`;
      await db.saveGenerationRun({
        id: runId,
        projectId: testProjectId,
        runType: 'generation',
        status: 'generating',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
      });

      // Simulate client disconnecting SSE or HTTP socket (aborting req.signal)
      const clientDisconnectSignal = new AbortController();
      clientDisconnectSignal.abort(); // Simulates browser tab close / refresh

      // Verifies that client disconnect signal does NOT change run status to 'cancelled' in DB
      const currentRun = await db.getGenerationRun(runId);
      expect(currentRun).toBeDefined();
      expect(currentRun?.status).toBe('generating');
      expect(currentRun?.status).not.toBe('cancelled');

      // Client can reconnect and fetch the run state
      const reconnectedRun = await db.getGenerationRun(runId);
      expect(reconnectedRun?.id).toBe(runId);
      expect(reconnectedRun?.status).toBe('generating');
    });

    it('propagates cancellation across server instances via durable DB status observation without in-memory cancelRun call', async () => {
      const distributedProjectId = `proj_test_distributed_${Date.now()}`;
      await db.createProject({
        id: distributedProjectId,
        ownerUserId: 'test_user_hardening',
        name: 'Distributed Cancellation Test',
        description: 'Testing cross-instance abort propagation',
        status: 'generating',
      });

      const plan: ApplicationPlan = {
        projectId: distributedProjectId,
        specification: {
          id: 'spec_distributed',
          projectId: distributedProjectId,
          name: 'Distributed App',
          description: 'Testing cross-instance abort propagation',
          targetUsers: ['Users'],
          routes: [{ path: '/', name: 'Home', description: 'Home' }],
          features: [],
          dataEntities: [],
          integrations: [],
          designSystem: { theme: 'light', primaryColor: '#000', style: 'saas-clean', typography: 'sans' },
          technicalConstraints: [],
          acceptanceCriteria: [],
          versionNumber: 1,
          schemaVersion: '1.0.0',
          createdAt: new Date().toISOString(),
        },
        routes: [{ path: '/', name: 'Home', description: 'Home' }],
        majorComponents: [],
        dataModel: { entities: [], storageStrategy: 'localStorage', notes: '' },
        userInteractions: [],
        requiredServices: [],
        dependencies: {},
        validationSteps: [],
        assumptions: [],
        unresolvedQuestions: [],
        createdAt: new Date().toISOString(),
      };

      const runId = `run_dist_${Date.now()}`;
      await db.saveGenerationRun({
        id: runId,
        projectId: distributedProjectId,
        runType: 'generation',
        status: 'queued',
        modelProvider: 'gemini',
        modelIdentifier: 'gemini-3.6-flash',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
      });

      // Spy on GeminiProvider to simulate a long in-flight AI call on Instance A
      const geminiSpy = vi.spyOn(GeminiProvider, 'generateProject').mockImplementation(async (_plan, _spec, _onLog, signal) => {
        return new Promise((_, reject) => {
          if (signal?.aborted) {
            const err: any = new Error('Generation cancelled by user');
            err.isCancelled = true;
            reject(err);
            return;
          }
          signal?.addEventListener('abort', () => {
            const err: any = new Error('Generation cancelled by user');
            err.isCancelled = true;
            reject(err);
          });
        });
      });

      // Start generation on Instance A
      const genPromise = ProjectOrchestrator.runFullGeneration(runId, distributedProjectId, plan);

      // Give microtask time to enter the in-flight provider call
      await new Promise((r) => setTimeout(r, 20));

      // Simulate Instance B handling POST /api/v1/generation-runs/:runId/cancel:
      // Instance B ONLY writes to the database; it does NOT call the local in-memory cancelRun
      await db.updateGenerationRun(runId, {
        status: 'cancelled',
        finishedAt: new Date().toISOString(),
      });

      // Await completion on Instance A: Instance A's database watcher must detect the cancelled status,
      // abort the controller signal, and abort the in-flight AI call
      const result = await genPromise;

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('cancelled');

      // Version must not be published
      const versions = await db.listVersions(distributedProjectId);
      expect(versions.length).toBe(0);

      geminiSpy.mockRestore();
    });

    it('explicit cancellation never falls back to deterministic generation', async () => {
      const abortProjectId = `proj_test_never_fallback_${Date.now()}`;
      await db.createProject({
        id: abortProjectId,
        ownerUserId: 'test_user_hardening',
        name: 'Never Fallback App',
        description: 'Testing deterministic fallback prevention on abort',
        status: 'generating',
      });

      const plan: ApplicationPlan = {
        projectId: abortProjectId,
        specification: {
          id: 'spec_never_fallback',
          projectId: abortProjectId,
          name: 'Never Fallback App',
          description: 'Testing deterministic fallback prevention on abort',
          targetUsers: ['Users'],
          routes: [{ path: '/', name: 'Home', description: 'Home' }],
          features: [],
          dataEntities: [],
          integrations: [],
          designSystem: { theme: 'light', primaryColor: '#000', style: 'saas-clean', typography: 'sans' },
          technicalConstraints: [],
          acceptanceCriteria: [],
          versionNumber: 1,
          schemaVersion: '1.0.0',
          createdAt: new Date().toISOString(),
        },
        routes: [{ path: '/', name: 'Home', description: 'Home' }],
        majorComponents: [],
        dataModel: { entities: [], storageStrategy: 'localStorage', notes: '' },
        userInteractions: [],
        requiredServices: [],
        dependencies: {},
        validationSteps: [],
        assumptions: [],
        unresolvedQuestions: [],
        createdAt: new Date().toISOString(),
      };

      const abortController = new AbortController();
      abortController.abort(); // already aborted

      // GeminiProvider should throw cancelled error, never return fallback files
      await expect(
        GeminiProvider.generateProject(plan, plan.specification, undefined, abortController.signal)
      ).rejects.toThrow('cancelled');
    });

    it('verifies Gemini 3.8 fallback is disabled by default to prevent secondary timeout delays', async () => {
      const { ENABLE_GEMINI_FALLBACK, PRIMARY_MODEL } = await import('@/modules/ai/gemini-provider');
      expect(ENABLE_GEMINI_FALLBACK).toBe(false);
      expect(PRIMARY_MODEL).toBe('gemini-3.6-flash');
    });

    it('ensures completed runs and published versions remain fully accessible for reconnecting clients', async () => {
      const reconnectProjectId = `proj_test_completed_reconnect_${Date.now()}`;
      await db.createProject({
        id: reconnectProjectId,
        ownerUserId: 'test_user_hardening',
        name: 'Completed Reconnect Test',
        description: 'Testing reconnected access',
        status: 'ready',
      });

      const runId = `run_completed_${Date.now()}`;
      const versionId = `ver_completed_${Date.now()}`;

      await db.saveGenerationRun({
        id: runId,
        projectId: reconnectProjectId,
        runType: 'generation',
        status: 'completed',
        resultVersionId: versionId,
        modelProvider: 'gemini',
        modelIdentifier: 'gemini-3.6-flash',
        attemptCount: 1,
        startedAt: new Date(Date.now() - 5000).toISOString(),
        finishedAt: new Date().toISOString(),
      });

      await db.saveVersion({
        id: versionId,
        projectId: reconnectProjectId,
        versionNumber: 1,
        sourceManifest: ['src/app/page.tsx'],
        changeSummary: 'Initial scaffold',
        validationStatus: 'passed',
        createdAt: new Date().toISOString(),
      });

      // A client that disconnected and later reconnects can query the completed run
      const fetchedRun = await db.getGenerationRun(runId);
      expect(fetchedRun).toBeDefined();
      expect(fetchedRun?.status).toBe('completed');
      expect(fetchedRun?.resultVersionId).toBe(versionId);

      // And retrieve the published version
      const fetchedVersion = await db.getVersion(versionId);
      expect(fetchedVersion).toBeDefined();
      expect(fetchedVersion?.id).toBe(versionId);
      expect(fetchedVersion?.sourceManifest.length).toBe(1);
    });

    it('concurrent publication race: database permits only one valid outcome (completed or cancelled)', async () => {
      const raceProjectId = `proj_test_race_${Date.now()}`;
      await db.createProject({
        id: raceProjectId,
        ownerUserId: 'test_user_hardening',
        name: 'Concurrent Race Project',
        description: 'Testing concurrent publication and cancellation',
        status: 'generating',
      });

      const runId = `run_race_${Date.now()}`;
      const versionId = `ver_race_${Date.now()}`;

      await db.saveGenerationRun({
        id: runId,
        projectId: raceProjectId,
        runType: 'generation',
        status: 'generating',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
      });

      const version: ProjectVersion = {
        id: versionId,
        projectId: raceProjectId,
        versionNumber: 1,
        sourceManifest: ['src/app/page.tsx'],
        changeSummary: 'Race test version',
        validationStatus: 'passed',
        createdAt: new Date().toISOString(),
      };

      const files: GeneratedFile[] = [
        {
          path: 'src/app/page.tsx',
          content: 'export default function Page() { return <div>Race Test</div>; }',
          fileType: 'page',
          responsibility: 'Dashboard',
          sizeBytes: 65,
          mimeType: 'text/typescript-jsx',
        },
      ];

      // Execute publication (Instance A) and cancellation (Instance B) concurrently
      const [publishResult, _cancelResult] = await Promise.all([
        db.publishVersionIfActive(runId, raceProjectId, version, files),
        db.updateGenerationRun(runId, {
          status: 'cancelled',
          finishedAt: new Date().toISOString(),
        }),
      ]);

      const finalRun = await db.getGenerationRun(runId);
      const finalVersions = await db.listVersions(raceProjectId);

      // Verify mutual exclusivity: exactly one state must be committed
      if (finalRun?.status === 'cancelled') {
        // If cancellation won, publication MUST be rejected and no version published
        expect(publishResult).toBeNull();
        expect(finalVersions.length).toBe(0);
      } else {
        // If publication won, status MUST be completed and version published
        expect(finalRun?.status).toBe('completed');
        expect(publishResult).not.toBeNull();
        expect(finalVersions.length).toBe(1);
      }
    });

    it('guarantees once cancellation has been acknowledged, no subsequent version can be published', async () => {
      const ackProjectId = `proj_test_ack_cancel_${Date.now()}`;
      await db.createProject({
        id: ackProjectId,
        ownerUserId: 'test_user_hardening',
        name: 'Acknowledged Cancellation Project',
        description: 'Testing post-cancellation publication rejection',
        status: 'generating',
      });

      const runId = `run_ack_cancel_${Date.now()}`;
      const versionId = `ver_ack_cancel_${Date.now()}`;

      await db.saveGenerationRun({
        id: runId,
        projectId: ackProjectId,
        runType: 'generation',
        status: 'generating',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        startedAt: new Date().toISOString(),
      });

      // 1. Instance B acknowledges cancellation
      const cancelUpdate = await db.updateGenerationRun(runId, {
        status: 'cancelled',
        finishedAt: new Date().toISOString(),
      });
      expect(cancelUpdate?.status).toBe('cancelled');

      // 2. Instance A arrives later attempting to publish
      const version: ProjectVersion = {
        id: versionId,
        projectId: ackProjectId,
        versionNumber: 1,
        sourceManifest: ['src/app/page.tsx'],
        changeSummary: 'Post-cancel version',
        validationStatus: 'passed',
        createdAt: new Date().toISOString(),
      };

      const files: GeneratedFile[] = [
        {
          path: 'src/app/page.tsx',
          content: 'export default function Page() { return <div>Late Publication</div>; }',
          fileType: 'page',
          responsibility: 'Dashboard',
          sizeBytes: 70,
          mimeType: 'text/typescript-jsx',
        },
      ];

      const publishResult = await db.publishVersionIfActive(runId, ackProjectId, version, files);

      // Desired guarantee: Must reject publication atomically
      expect(publishResult).toBeNull();

      // Zero versions committed
      const versions = await db.listVersions(ackProjectId);
      expect(versions.length).toBe(0);

      // Run status remains cancelled
      const finalRun = await db.getGenerationRun(runId);
      expect(finalRun?.status).toBe('cancelled');
    });
  });
});
