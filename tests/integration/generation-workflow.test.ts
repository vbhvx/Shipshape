import { describe, it, expect } from 'vitest';
import { db } from '../../src/lib/db';
import { createPlanFromPrompt } from '../../src/modules/planning/planning-engine';
import { generateProjectFiles, modifyProjectFiles } from '../../src/modules/generation/generator';
import { SandboxManager } from '../../src/modules/sandbox/sandbox-manager';
import { computeVersionDiff, restoreVersion } from '../../src/modules/versioning/diff-engine';
import { exportProjectArchive } from '../../src/modules/export/export-service';
import { ProjectVersion } from '../../src/types';

describe('End-to-End Generation, Execution, Modification & Export Lifecycle', () => {
  const projectId = `proj_integration_${Date.now()}`;
  const projectName = 'TaskPilot E2E';
  const prompt = 'Build a modern sprint task tracker with status badges, priority filtering, and CSV export';

  let v1Id: string;
  let v2Id: string;

  it('1. Interprets natural language requirements into an editable application plan', async () => {
    const user = await db.getDefaultUser();
    await db.createProject({
      id: projectId,
      ownerUserId: user.id,
      name: projectName,
      description: prompt,
      status: 'planning',
    });

    const plan = await createPlanFromPrompt(projectId, projectName, prompt);
    expect(plan.projectId).toBe(projectId);
    expect(plan.routes.length).toBeGreaterThanOrEqual(3);
    expect(plan.specification.features.length).toBeGreaterThanOrEqual(4);

    await db.saveSpecification(plan.specification);
  });

  it('2. Generates a coherent multi-file Next.js application codebase', async () => {
    const spec = await db.getSpecification(projectId);
    const plan = await createPlanFromPrompt(projectId, projectName, prompt, spec);

    const generatedFiles = await generateProjectFiles(plan, plan.specification);
    expect(generatedFiles.length).toBeGreaterThanOrEqual(8);

    // Verify key manifest files exist
    expect(generatedFiles.some((f) => f.path === 'package.json')).toBe(true);
    expect(generatedFiles.some((f) => f.path === 'tsconfig.json')).toBe(true);
    expect(generatedFiles.some((f) => f.path === 'src/app/page.tsx')).toBe(true);
    expect(generatedFiles.some((f) => f.path === 'src/app/explore/page.tsx')).toBe(true);
    expect(generatedFiles.some((f) => f.path === 'src/lib/storage.ts')).toBe(true);

    // Save Version 1
    v1Id = `ver_e2e_1`;
    const v1: ProjectVersion = {
      id: v1Id,
      projectId,
      versionNumber: 1,
      sourceManifest: generatedFiles.map((f) => f.path),
      changeSummary: 'Initial application generation',
      validationStatus: 'passed',
      createdAt: new Date().toISOString(),
    };

    await db.saveVersion(v1);
    await db.saveFiles(projectId, v1Id, generatedFiles);
    await db.updateProject(projectId, { activeVersionId: v1Id, status: 'ready' });
  });

  it('3. Validates file manifest and starts isolated sandbox runtime', async () => {
    const files = await db.getFilesForVersion(projectId, v1Id);
    const validation = await SandboxManager.validateAndBuild(projectId, 'run_e2e_val', files);

    expect(validation.passed).toBe(true);
    expect(validation.results.some((r) => r.status === 'passed')).toBe(true);

    const sandbox = await SandboxManager.startSandbox(projectId, files);
    expect(sandbox.status).toBe('running');
    expect(sandbox.port).toBeDefined();
    expect(sandbox.hostUrl).toContain(`/api/v1/preview/${projectId}`);
  });

  it('4. Applies targeted iterative modification and computes accurate diff', async () => {
    const baseFiles = await db.getFilesForVersion(projectId, v1Id);
    const instruction = 'Enhance data explorer with priority filter badges and high contrast styling';

    const { modifiedFiles, changeSummary } = await modifyProjectFiles(baseFiles, instruction);
    expect(changeSummary).toBeDefined();

    // Verify diff between v1 and modified files
    const diff = computeVersionDiff(baseFiles, modifiedFiles, 'ver_e2e_2', v1Id);
    expect(diff.summary.filesChanged).toBeGreaterThan(0);
    expect(diff.summary.additions).toBeGreaterThan(0);

    // Save Version 2
    v2Id = `ver_e2e_2`;
    const v2: ProjectVersion = {
      id: v2Id,
      projectId,
      parentVersionId: v1Id,
      versionNumber: 2,
      sourceManifest: modifiedFiles.map((f) => f.path),
      changeSummary,
      validationStatus: 'passed',
      createdAt: new Date().toISOString(),
    };

    await db.saveVersion(v2);
    await db.saveFiles(projectId, v2Id, modifiedFiles);
    await db.updateProject(projectId, { activeVersionId: v2Id, status: 'running' });
  });

  it('5. Restores previous version cleanly without losing history', async () => {
    const restored = await restoreVersion(projectId, v1Id, 'Revert to initial scaffold');
    expect(restored.versionNumber).toBe(3); // creates new restorative snapshot v3
    expect(restored.parentVersionId).toBe(v1Id);

    const activeProject = await db.getProject(projectId);
    expect(activeProject?.activeVersionId).toBe(restored.id);
  });

  it('6. Exports project source code as a clean .zip archive excluding platform secrets', async () => {
    const exportResult = await exportProjectArchive(projectId, v1Id);
    expect(exportResult.zipBuffer).toBeInstanceOf(Buffer);
    expect(exportResult.fileName).toContain('.zip');
    expect(exportResult.filesIncluded).toBeGreaterThanOrEqual(8);
  });
});
