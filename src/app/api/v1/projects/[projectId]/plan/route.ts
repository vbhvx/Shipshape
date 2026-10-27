import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createPlanFromPrompt } from '@/modules/planning/planning-engine';
import { PlanRequestSchema } from '@/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const project = await db.getProject(projectId);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = PlanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid prompt', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const existingSpec = await db.getSpecification(projectId);
    const plan = await createPlanFromPrompt(projectId, project.name, parsed.data.prompt, existingSpec);

    // Save specification to database
    await db.saveSpecification(plan.specification);
    await db.updateProject(projectId, {
      description: parsed.data.prompt,
      status: 'planning',
    });

    return NextResponse.json({ success: true, plan });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const spec = await db.getSpecification(projectId);
    if (!spec) {
      return NextResponse.json({ success: false, error: 'No plan or specification exists yet' }, { status: 404 });
    }
    return NextResponse.json({ success: true, specification: spec });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
