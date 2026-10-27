import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CreateProjectSchema } from '@/types';

export async function GET() {
  try {
    const { seedDemoProject } = await import('@/lib/db/seed');
    await seedDemoProject();
    const user = await db.getDefaultUser();
    const projects = await db.listProjects(user.id);
    return NextResponse.json({ success: true, projects });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await db.getDefaultUser();
    const body = await req.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const project = await db.createProject({
      id: projectId,
      ownerUserId: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      status: 'draft',
    });

    await db.recordAudit('project_created', projectId, user.id, { name: project.name });

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
