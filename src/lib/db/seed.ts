import { db } from './index';
import { createPlanFromPrompt } from '@/modules/planning/planning-engine';
import { generateProjectFiles, modifyProjectFiles } from '@/modules/generation/generator';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';
import { ProjectVersion } from '@/types';

export async function seedDemoProject(): Promise<void> {
  const user = await db.getDefaultUser();
  const existing = await db.listProjects(user.id);
  if (existing.length > 0) return; // Already seeded

  const projectId = 'proj_taskflow_showcase';
  const projectName = 'TaskFlow Pro';
  const projectPrompt =
    'Build a high-performance Kanban and sprint task management application with drag-and-drop workflow columns, priority tagging, status metrics, dark mode, real-time client persistence, and CSV export.';

  // 1. Create Project
  const project = await db.createProject({
    id: projectId,
    ownerUserId: user.id,
    name: projectName,
    description: projectPrompt,
    status: 'running',
  });

  // 2. Create Plan & Specification
  const plan = await createPlanFromPrompt(projectId, projectName, projectPrompt);
  await db.saveSpecification(plan.specification);

  // 3. Generate Version 1 Files
  const v1Files = await generateProjectFiles(plan, plan.specification);
  const v1Id = 'ver_taskflow_v1';
  const v1: ProjectVersion = {
    id: v1Id,
    projectId,
    versionNumber: 1,
    sourceManifest: v1Files.map((f) => f.path),
    changeSummary: 'Initial application scaffold and interactive Kanban board',
    validationStatus: 'passed',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  };

  await db.saveVersion(v1);
  await db.saveFiles(projectId, v1Id, v1Files);

  // 4. Generate Version 2 (Iterative Enhancement: High-contrast Dark theme and Priority Filter)
  const { modifiedFiles: v2Files, changeSummary } = await modifyProjectFiles(
    v1Files,
    'Enhance data explorer with priority filter badges and high contrast styling'
  );
  const v2Id = 'ver_taskflow_v2';
  const v2: ProjectVersion = {
    id: v2Id,
    projectId,
    parentVersionId: v1Id,
    versionNumber: 2,
    sourceManifest: v2Files.map((f) => f.path),
    changeSummary,
    validationStatus: 'passed',
    createdAt: new Date().toISOString(),
  };

  await db.saveVersion(v2);
  await db.saveFiles(projectId, v2Id, v2Files);

  // Set active version to v2
  await db.updateProject(projectId, { activeVersionId: v2Id, status: 'running' });

  // 5. Initialize Sandbox Runtime & Preview Session
  await SandboxManager.startSandbox(projectId, v2Files);

  // 6. Record Initial Audit Event
  await db.recordAudit('project_created', projectId, user.id, { name: projectName });

  console.log(`[SEED] Seeded initial showcase project: ${projectName} (${projectId})`);
}
