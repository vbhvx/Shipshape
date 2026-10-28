import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createPlanFromPrompt } from '@/modules/planning/planning-engine';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import { ApplicationPlan, GenerateRequestSchema, GenerationRun } from '@/types';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

// This workflow executes inside the request so a run always reaches a durable
// terminal state. A production deployment that needs longer AI jobs should
// replace this with a durable queue/worker, not a post-response callback.
export const maxDuration = 60;

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

    const body = await req.json().catch(() => null);
    const parsed = GenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid generation request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const activeRun = await db.getLatestGenerationRun(projectId);
    if (activeRun && ['queued', 'planning', 'generating', 'validating', 'building', 'repairing', 'starting', 'preview_ready'].includes(activeRun.status)) {
      return NextResponse.json(
        { success: false, error: 'A generation is already in progress for this project', runId: activeRun.id },
        { status: 409 }
      );
    }

    let plan = parsed.data.plan as ApplicationPlan | undefined;

    // A new prompt intentionally produces a fresh plan. Reusing a prior
    // specification here made retries silently ignore what the user typed.
    if (!plan) {
      const spec = await db.getSpecification(projectId);

      if (spec && !parsed.data.prompt) {
        plan = await createPlanFromPrompt(
          projectId,
          project.name,
          spec.description,
          spec
        );
      } else {
        const prompt = parsed.data.prompt || project.description || 'Full-stack application';

        plan = await createPlanFromPrompt(
          projectId,
          project.name,
          prompt,
          spec
        );

        await db.saveSpecification(plan.specification);
      }
    }

    const runId = `run_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;

    const newRun: GenerationRun = {
      id: runId,
      projectId,
      runType: 'generation',
      status: 'queued',
      modelProvider: 'deterministic',
      modelIdentifier: 'deterministic-engine-v1',
      attemptCount: 1,
      prompt: parsed.data.prompt || project.description,
      startedAt: new Date().toISOString(),
    };

    await db.saveGenerationRun(newRun);
    await db.updateProject(projectId, { status: 'generating' });

    const result = await ProjectOrchestrator.runFullGeneration(runId, projectId, plan);
    const run = await db.getGenerationRun(runId);

    return NextResponse.json({
      success: true,
      runId,
      run,
      status: run?.status || (result.success ? 'completed' : 'failed'),
      message: result.success
        ? 'Generation completed successfully'
        : 'Generation failed; inspect the run diagnostics for details',
    });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to start project generation:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to start project generation' },
      { status: 500 }
    );
  }
}
