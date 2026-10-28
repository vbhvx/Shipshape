import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UpdateProjectSchema } from '@/types';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

export async function GET(
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

    const versions = await db.listVersions(projectId);
    const spec = await db.getSpecification(projectId);
    const sandbox = await db.getSandboxSession(projectId);

    return NextResponse.json({
      success: true,
      project,
      specification: spec,
      latestVersion: versions[0] || null,
      versionsCount: versions.length,
      sandbox,
    });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to get project:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to get project' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body = await req.json();
    const parsed = UpdateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await db.updateProject(projectId, parsed.data);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, project: updated });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to update project:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const success = await db.deleteProject(projectId);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Project archived' });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to delete project:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
