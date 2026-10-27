import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';

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

    if (!project.activeVersionId) {
      return NextResponse.json(
        { success: false, error: 'Cannot start runtime: No generated version exists yet' },
        { status: 400 }
      );
    }

    const files = await db.getFilesForVersion(projectId, project.activeVersionId);
    const session = await SandboxManager.startSandbox(projectId, files);
    await db.updateProject(projectId, { status: 'running' });

    return NextResponse.json({ success: true, session });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
