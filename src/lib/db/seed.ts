import { db } from './index';
import { createPlanFromPrompt } from '@/modules/planning/planning-engine';
import { generateProjectFiles, modifyProjectFiles } from '@/modules/generation/generator';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';
import { ProjectVersion } from '@/types';

interface SeedProjectDefinition {
  id: string;
  name: string;
  prompt: string;
  v2Modification: string;
}

export const REAL_SHOWCASE_PROJECTS: SeedProjectDefinition[] = [
  {
    id: 'proj_pulsestream_ops',
    name: 'PulseStream Cloud Observability',
    prompt:
      'Build a distributed cloud infrastructure observability platform tracking service health, API latency percentiles, error budget burn rates, cluster nodes, and automated incident escalation.',
    v2Modification:
      'Add high-priority alert badges, real-time node filter, and high-contrast night vision mode',
  },
  {
    id: 'proj_kroma_studio',
    name: 'Kroma Creative Asset Studio',
    prompt:
      'Build a collaborative digital asset management workspace for creative teams with multi-format asset cataloging, status approval workflows, reviewer tagging, and CSV data export.',
    v2Modification:
      'Enhance asset catalog with priority status filters and one-click batch export',
  },
  {
    id: 'proj_auracraft_store',
    name: 'AuraCraft Olfactory Fragrances',
    prompt:
      'Build a luxury artisanal fragrance boutique featuring scent profile pyramid notes, interactive bottle selection, real-time shopping cart calculation, and stock inventory tracking.',
    v2Modification:
      'Add limited-edition fragrance tags and interactive cart discount code calculation',
  },
  {
    id: 'proj_veloce_crm',
    name: 'Veloce Capital Deal Pipeline',
    prompt:
      'Build an early-stage venture capital deal pipeline CRM tracking startup funding rounds, syndicate partners, founder evaluation notes, valuation metrics, and portfolio ROI.',
    v2Modification:
      'Add stage-specific deal filters, valuation sorting, and confidential CSV export',
  },
];

export async function seedDemoProject(): Promise<void> {
  const user = await db.getDefaultUser();
  const existingProjects = await db.listProjects(user.id);

  // If projects exist with generic 'TaskPilot E2E' names, rename them to realistic names
  if (existingProjects.length > 0) {
    let changed = false;
    for (let i = 0; i < existingProjects.length; i++) {
      const p = existingProjects[i];
      if (p.name.includes('TaskPilot') || p.name === 'TaskFlow Pro' || existingProjects.filter(ep => ep.name === p.name).length > 1) {
        const seedDef = REAL_SHOWCASE_PROJECTS[i % REAL_SHOWCASE_PROJECTS.length];
        await db.updateProject(p.id, {
          name: seedDef.name,
          description: seedDef.prompt,
        });

        // Update specification name as well if exists
        const spec = await db.getSpecification(p.id);
        if (spec) {
          spec.name = seedDef.name;
          spec.description = seedDef.prompt;
          await db.saveSpecification(spec);
        }
        changed = true;
      }
    }
    if (changed) {
      console.log('[SEED] Renamed active projects to realistic product names.');
    }
    return;
  }

  // Otherwise seed all 4 distinct projects from scratch
  for (const def of REAL_SHOWCASE_PROJECTS) {
    // 1. Create Project
    await db.createProject({
      id: def.id,
      ownerUserId: user.id,
      name: def.name,
      description: def.prompt,
      status: 'running',
    });

    // 2. Create Plan & Specification
    const plan = await createPlanFromPrompt(def.id, def.name, def.prompt);
    await db.saveSpecification(plan.specification);

    // 3. Generate Version 1 Files
    const v1Files = await generateProjectFiles(plan, plan.specification);
    const v1Id = `ver_${def.id}_v1`;
    const v1: ProjectVersion = {
      id: v1Id,
      projectId: def.id,
      versionNumber: 1,
      sourceManifest: v1Files.map((f) => f.path),
      changeSummary: 'Initial application scaffold & interactive architecture',
      validationStatus: 'passed',
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    };

    await db.saveVersion(v1);
    await db.saveFiles(def.id, v1Id, v1Files);

    // 4. Generate Version 2
    const { modifiedFiles: v2Files, changeSummary } = await modifyProjectFiles(
      v1Files,
      def.v2Modification
    );
    const v2Id = `ver_${def.id}_v2`;
    const v2: ProjectVersion = {
      id: v2Id,
      projectId: def.id,
      parentVersionId: v1Id,
      versionNumber: 2,
      sourceManifest: v2Files.map((f) => f.path),
      changeSummary,
      validationStatus: 'passed',
      createdAt: new Date().toISOString(),
    };

    await db.saveVersion(v2);
    await db.saveFiles(def.id, v2Id, v2Files);

    // Set active version to v2
    await db.updateProject(def.id, { activeVersionId: v2Id, status: 'running' });

    // 5. Initialize Sandbox Runtime & Preview
    await SandboxManager.startSandbox(def.id, v2Files);
    await db.recordAudit('project_created', def.id, user.id, { name: def.name });

    console.log(`[SEED] Seeded realistic showcase project: ${def.name} (${def.id})`);
  }
}
