import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createPlanFromPrompt } from '@/modules/planning/planning-engine';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import { GenerationRun } from '@/types';

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

    const body = await req.json().catch(() => ({}));
    let plan = body.plan;

    // If no explicit plan passed, load from DB or synthesize from prompt/description
    if (!plan) {
      const spec = await db.getSpecification(projectId);
      if (spec) {
        plan = await createPlanFromPrompt(projectId, project.name, spec.description, spec);
      } else {
        const prompt = body.prompt || project.description || 'Full-stack application';
        plan = await createPlanFromPrompt(projectId, project.name, prompt);
        await db.saveSpecification(plan.specification);
      }
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRun: GenerationRun = {
      id: runId,
      projectId,
      runType: 'generation',
      status: 'queued',
      modelProvider: body.modelProvider || 'deterministic',
      modelIdentifier: 'gemini-1.5-pro',
      attemptCount: 1,
      prompt: body.prompt || project.description,
      startedAt: new Date().toISOString(),
    };

    await db.saveGenerationRun(newRun);
    await db.updateProject(projectId, { status: 'generating' });

    // Launch orchestrator execution asynchronously
    void ProjectOrchestrator.runFullGeneration(runId, projectId, plan);

    return NextResponse.json({
      success: true,
      runId,
      status: 'queued',
      message: 'Generation run started successfully',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
