import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import { ModifyRequestSchema, GenerationRun } from '@/types';

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
    const parsed = ModifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid modification instruction', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const runId = `run_mod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRun: GenerationRun = {
      id: runId,
      projectId,
      baseVersionId: parsed.data.baseVersionId || project.activeVersionId,
      runType: 'modification',
      status: 'queued',
      modelProvider: 'deterministic',
      modelIdentifier: 'gemini-1.5-pro',
      attemptCount: 1,
      prompt: parsed.data.instruction,
      startedAt: new Date().toISOString(),
    };

    await db.saveGenerationRun(newRun);
    await db.updateProject(projectId, { status: 'generating' });

    // Launch modification run asynchronously
    void ProjectOrchestrator.runModification(
      runId,
      projectId,
      parsed.data.instruction,
      parsed.data.baseVersionId || project.activeVersionId
    );

    return NextResponse.json({
      success: true,
      runId,
      status: 'queued',
      message: 'Modification run queued',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
