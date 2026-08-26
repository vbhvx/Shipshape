import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

    const spec = await db.getSpecification(projectId);
    if (!spec) {
      return NextResponse.json({ success: false, error: 'Specification not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, specification: spec });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to get specification:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to get specification' },
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

    const spec = await db.getSpecification(projectId);
    if (!spec) {
      return NextResponse.json({ success: false, error: 'Specification not found' }, { status: 404 });
    }

    const updates = await req.json();
    const updatedSpec = {
      ...spec,
      ...updates,
      projectId,
      versionNumber: spec.versionNumber + 1,
    };

    await db.saveSpecification(updatedSpec);
    return NextResponse.json({ success: true, specification: updatedSpec });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to update specification:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to update specification' },
      { status: 500 }
    );
  }
}
