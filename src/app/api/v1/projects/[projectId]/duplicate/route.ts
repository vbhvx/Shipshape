import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;
    const project = await getOwnedProject(projectId, user.id);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const newProjectId = `proj_${crypto.randomUUID()}`;
    const newProject = await db.createProject({
      id: newProjectId,
      ownerUserId: user.id,
      name: `${project.name} (Copy)`,
      description: project.description,
      status: project.status,
    });

    // Copy specification if present
    const spec = await db.getSpecification(projectId);
    if (spec) {
      await db.saveSpecification({
        ...spec,
        id: `spec_${crypto.randomUUID()}`,
        projectId: newProjectId,
        name: spec.name ? `${spec.name} (Copy)` : `${project.name} (Copy)`,
      });
    }

    // Copy latest version and files if present
    const versions = await db.listVersions(projectId);
    if (versions.length > 0) {
      const latestVersion = versions[0];
      const newVersionId = `ver_${crypto.randomUUID()}`;
      const files = await db.getFilesForVersion(projectId, latestVersion.id);

      await db.saveVersion({
        ...latestVersion,
        id: newVersionId,
        projectId: newProjectId,
      });

      if (files.length > 0) {
        await db.saveFiles(newProjectId, newVersionId, files);
      }

      await db.updateProject(newProjectId, { activeVersionId: newVersionId });
    }

    return NextResponse.json(
      {
        success: true,
        project: newProject,
        message: 'Project duplicated successfully',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to duplicate project:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to duplicate project' },
      { status: 500 }
    );
  }
}
