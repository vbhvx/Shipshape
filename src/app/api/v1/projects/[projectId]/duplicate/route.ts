import { db } from '@/lib/db';
import { requireAuth, requireOwnedProject } from '@/lib/auth/session';
import { apiRoute } from '@/lib/http/handler';
import { enforceRateLimit, RateLimits } from '@/lib/http/rate-limit';
import { newId } from '@/lib/ids';

export const POST = apiRoute<{ projectId: string }>('projects.duplicate', async (_req, { params }) => {
  const user = await requireAuth();
  const { projectId } = await params;
  const project = await requireOwnedProject(projectId, user.id);
  await enforceRateLimit(RateLimits.mutation, user.id);

  const newProjectId = newId('proj');
  const newProject = await db.createProject({
    id: newProjectId,
    ownerUserId: user.id,
    name: `${project.name} (Copy)`,
    description: project.description,
    status: project.status,
  });

  const [spec, versions] = await Promise.all([db.getSpecification(projectId), db.listVersions(projectId)]);

  if (spec) {
    await db.saveSpecification({
      ...spec,
      id: newId('spec'),
      projectId: newProjectId,
      name: spec.name ? `${spec.name} (Copy)` : `${project.name} (Copy)`,
    });
  }

  // Only the latest snapshot is copied; history stays with the source project.
  if (versions.length > 0) {
    const latestVersion = versions[0];
    const newVersionId = newId('ver');
    const files = await db.getFilesForVersion(projectId, latestVersion.id);

    await db.saveVersion({ ...latestVersion, id: newVersionId, projectId: newProjectId });
    if (files.length > 0) {
      await db.saveFiles(newProjectId, newVersionId, files);
    }
    await db.updateProject(newProjectId, { activeVersionId: newVersionId });
  }

  await db.recordAudit('project_duplicated', newProjectId, user.id, { sourceProjectId: projectId });

  return Response.json(
    { success: true, project: newProject, message: 'Project duplicated successfully' },
    { status: 201 }
  );
}, { fallbackError: 'Failed to duplicate project' });
