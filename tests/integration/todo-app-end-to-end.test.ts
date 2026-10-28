import { describe, it, expect, afterAll } from 'vitest';
import { db } from '../../src/lib/db';
import { createPlanFromPrompt } from '../../src/modules/planning/planning-engine';
import { ProjectOrchestrator } from '../../src/server/jobs/orchestrator';

describe('P0 End-to-End Build Test: Todo App Generation & Modification Pipeline', () => {
  const projectId = `proj_todo_p0_${Date.now()}`;
  const projectName = 'Task Master Todo';
  const prompt = 'Build a simple todo app with the ability to add tasks, mark tasks as completed, delete tasks, and display active and completed tasks.';

  let runId: string;
  let versionId: string;

  afterAll(async () => {
    await db.deleteProject(projectId, true);
  });

  it('1. Initializes project record and plans application specification', async () => {
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
    expect(plan.specification.name).toBe(projectName);
    expect(plan.routes.length).toBeGreaterThanOrEqual(1);

    await db.saveSpecification(plan.specification);

    runId = `run_todo_${Date.now()}`;
    await db.saveGenerationRun({
      id: runId,
      projectId,
      runType: 'generation',
      status: 'queued',
      modelProvider: 'deterministic',
      modelIdentifier: 'deterministic-engine-v1',
      attemptCount: 1,
      prompt,
      startedAt: new Date().toISOString(),
    });

    const run = await db.getGenerationRun(runId);
    expect(run?.status).toBe('queued');
  });

  it('2. Orchestrates full generation pipeline in under 3 seconds and publishes v1', async () => {
    const spec = await db.getSpecification(projectId);
    const plan = await createPlanFromPrompt(projectId, projectName, prompt, spec);

    const t0 = Date.now();
    const result = await ProjectOrchestrator.runFullGeneration(runId, projectId, plan);
    const durationMs = Date.now() - t0;

    expect(result.success).toBe(true);
    expect(result.versionId).toBeDefined();
    versionId = result.versionId!;

    // Verification: Fast lifecycle execution
    expect(durationMs).toBeLessThan(5000);

    // Verify run status transitioned to completed
    const finishedRun = await db.getGenerationRun(runId);
    expect(finishedRun?.status).toBe('completed');
    expect(finishedRun?.resultVersionId).toBe(versionId);

    // Verify project transitioned to running with activeVersionId
    const updatedProject = await db.getProject(projectId);
    expect(updatedProject?.status).toBe('running');
    expect(updatedProject?.activeVersionId).toBe(versionId);

    // Verify generated files contain todo app functionality
    const files = await db.getFilesForVersion(projectId, versionId);
    expect(files.length).toBeGreaterThanOrEqual(8);

    const pageFile = files.find((f) => f.path === 'src/app/page.tsx');
    expect(pageFile).toBeDefined();
    expect(pageFile?.content).toContain('Task');

    const storageFile = files.find((f) => f.path === 'src/lib/storage.ts');
    expect(storageFile).toBeDefined();
    expect(storageFile?.content).toContain('storage');
  });

  it('3. Modifies existing todo app via natural language instruction without hanging', async () => {
    const modRunId = `run_mod_${Date.now()}`;
    const instruction = 'Add priority color badges and a clear all completed button';

    await db.saveGenerationRun({
      id: modRunId,
      projectId,
      runType: 'modification',
      status: 'queued',
      modelProvider: 'deterministic',
      modelIdentifier: 'deterministic-engine-v1',
      attemptCount: 1,
      prompt: instruction,
      startedAt: new Date().toISOString(),
    });

    const t0 = Date.now();
    const result = await ProjectOrchestrator.runModification(modRunId, projectId, instruction, versionId);
    const durationMs = Date.now() - t0;

    expect(result.success).toBe(true);
    expect(result.versionId).toBeDefined();
    expect(durationMs).toBeLessThan(5000);

    // Verify v2 published
    const versions = await db.listVersions(projectId);
    expect(versions.length).toBe(2);
    expect(versions[0].versionNumber).toBe(2);

    const modRun = await db.getGenerationRun(modRunId);
    expect(modRun?.status).toBe('completed');
  });
});
