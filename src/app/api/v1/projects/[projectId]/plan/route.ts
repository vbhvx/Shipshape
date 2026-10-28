import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createPlanFromPrompt } from '@/modules/planning/planning-engine';
import { PlanRequestSchema } from '@/types';
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

    const body = await req.json();
    const parsed = PlanRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid prompt',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const existingSpec = await db.getSpecification(projectId);

    const plan = await createPlanFromPrompt(
      projectId,
      project.name,
      parsed.data.prompt,
      existingSpec
    );

    await db.saveSpecification(plan.specification);

    await db.updateProject(projectId, {
      description: parsed.data.prompt,
      status: 'planning',
    });

    return NextResponse.json({ success: true, plan });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to create project plan:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to create project plan' },
      { status: 500 }
    );
  }
}

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
      return NextResponse.json(
        { success: false, error: 'No plan or specification exists yet' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, specification: spec });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to retrieve project plan:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to retrieve project plan' },
      { status: 500 }
    );
  }
}
