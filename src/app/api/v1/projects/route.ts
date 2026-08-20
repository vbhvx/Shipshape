import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CreateProjectSchema } from '@/types';
import {
  requireAuth,
  AuthSessionError,
} from '@/lib/auth/session';

export async function GET() {
  try {
    const user = await requireAuth();
    const projects = await db.listProjects(user.id);

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to list projects:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to list projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid project data',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const projectId = `proj_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;

    const project = await db.createProject({
      id: projectId,
      ownerUserId: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      status: 'draft',
    });

    await db.recordAudit('project_created', projectId, user.id, {
      name: project.name,
    });

    return NextResponse.json(
      { success: true, project },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to create project:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
