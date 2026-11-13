import { describe, it, expect } from 'vitest';
import {
  canTransitionProject,
  canTransitionRun,
  illegalProjectPredecessors,
  projectStatusAfterRun,
  runPredecessors,
} from '@/lib/runs/status';
import { db } from '@/lib/db';
import { settleProjectAfterRun } from '@/server/jobs/run-lifecycle';
import { newId } from '@/lib/ids';
import type { GenerationRun, ProjectStatus } from '@/types';

describe('run state machine', () => {
  it('allows the documented forward steps for generation and modification', () => {
    const generation = ['queued', 'planning', 'generating', 'validating', 'building', 'starting', 'preview_ready'] as const;
    for (let i = 1; i < generation.length; i++) {
      expect(canTransitionRun(generation[i - 1], generation[i])).toBe(true);
    }
    expect(canTransitionRun('queued', 'generating')).toBe(true); // modifications skip planning
    expect(canTransitionRun('building', 'repairing')).toBe(true);
    expect(canTransitionRun('repairing', 'validating')).toBe(true); // re-validate after a repair
  });

  it('rejects skipped and backward steps', () => {
    expect(canTransitionRun('queued', 'building')).toBe(false);
    expect(canTransitionRun('building', 'planning')).toBe(false);
    expect(canTransitionRun('preview_ready', 'building')).toBe(false);
  });

  it('lets any in-progress state end, and never changes a finished run', () => {
    for (const end of ['completed', 'failed', 'cancelled'] as const) {
      expect(canTransitionRun('validating', end)).toBe(true);
      expect(canTransitionRun(end, 'building')).toBe(false);
      expect(canTransitionRun(end, 'failed')).toBe(false);
    }
  });

  it('lists predecessors for atomic conditional updates', () => {
    const before = runPredecessors('validating');
    expect(before).toEqual(expect.arrayContaining(['generating', 'repairing', 'validating']));
    expect(before).not.toContain('queued');
    expect(before).not.toContain('completed');
  });
});

describe('project state machine', () => {
  it('follows run outcomes', () => {
    expect(projectStatusAfterRun('completed', true)).toBe('running');
    expect(projectStatusAfterRun('failed', true)).toBe('error');
    expect(projectStatusAfterRun('cancelled', true)).toBe('ready');
    expect(projectStatusAfterRun('cancelled', false)).toBe('draft');
  });

  it('rejects moves that would hide an active run', () => {
    expect(canTransitionProject('generating', 'planning')).toBe(false);
    expect(illegalProjectPredecessors('planning')).toContain('generating');
  });

  it('lets a re-planned project with versions be restored or run', () => {
    expect(canTransitionProject('planning', 'ready')).toBe(true);
    expect(canTransitionProject('planning', 'running')).toBe(true);
  });

  it('lets legacy statuses from before these rules move to a valid one', () => {
    expect(canTransitionProject('archived', 'ready')).toBe(true);
    expect(canTransitionProject('building', 'generating')).toBe(true);
  });
});

// The local JSON store is the adapter under test here (no DATABASE_URL in unit tests);
// the Postgres adapter applies the same tables in its conditional updates.
async function makeProject(status: ProjectStatus, activeVersionId?: string) {
  const project = await db.createProject({
    id: newId('proj_sm'),
    ownerUserId: 'usr_state_machine',
    name: 'State machine',
    description: 'State machine test project',
    status: 'draft',
  });
  if (status !== 'draft') await db.updateProject(project.id, { status: 'generating' });
  if (status !== 'draft' && status !== 'generating') await db.updateProject(project.id, { status });
  if (activeVersionId) await db.updateProject(project.id, { activeVersionId });
  return project.id;
}

async function makeRun(projectId: string, status: GenerationRun['status'], startedAt = new Date().toISOString()) {
  const run: GenerationRun = {
    id: newId('run_sm'),
    projectId,
    runType: 'generation',
    status,
    modelProvider: 'deterministic',
    modelIdentifier: 'deterministic-engine-v1',
    attemptCount: 1,
    startedAt,
  };
  await db.saveGenerationRun(run);
  return run.id;
}

describe('storage adapter enforcement', () => {
  it('refuses an illegal run transition and keeps the current state', async () => {
    const projectId = await makeProject('generating');
    const runId = await makeRun(projectId, 'queued');

    const skipped = await db.updateGenerationRun(runId, { status: 'building' });
    expect(skipped?.status).toBe('queued');

    expect((await db.updateGenerationRun(runId, { status: 'planning' }))?.status).toBe('planning');
  });

  it('never resurrects a cancelled run when a late step write arrives', async () => {
    const projectId = await makeProject('generating');
    const runId = await makeRun(projectId, 'generating');
    await db.updateGenerationRun(runId, { status: 'cancelled' });

    const late = await db.updateGenerationRun(runId, { status: 'validating' });
    expect(late?.status).toBe('cancelled');
  });

  it('refuses an illegal project transition', async () => {
    const projectId = await makeProject('generating');
    const result = await db.updateProject(projectId, { status: 'planning' });
    expect(result?.status).toBe('generating');
  });
});

describe('settleProjectAfterRun', () => {
  it.each([
    ['cancelled', undefined, 'draft'],
    ['cancelled', 'ver_existing', 'ready'],
    ['failed', 'ver_existing', 'error'],
  ] as const)('a %s run (version %s) leaves the project %s instead of stuck generating', async (outcome, version, expected) => {
    const projectId = await makeProject('generating', version);
    const runId = await makeRun(projectId, 'building');
    await db.updateGenerationRun(runId, { status: outcome });

    await settleProjectAfterRun(runId, projectId);
    expect((await db.getProject(projectId))?.status).toBe(expected);
  });

  it('does nothing while the run is still in progress', async () => {
    const projectId = await makeProject('generating');
    const runId = await makeRun(projectId, 'building');
    await settleProjectAfterRun(runId, projectId);
    expect((await db.getProject(projectId))?.status).toBe('generating');
  });

  it('never lets an older run overwrite the status a newer run owns', async () => {
    const projectId = await makeProject('generating');
    const older = await makeRun(projectId, 'building', new Date(Date.now() - 60_000).toISOString());
    await makeRun(projectId, 'generating');
    await db.updateGenerationRun(older, { status: 'failed' });

    await settleProjectAfterRun(older, projectId);
    expect((await db.getProject(projectId))?.status).toBe('generating');
  });
});
