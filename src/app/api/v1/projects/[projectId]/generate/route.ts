import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { createPlanFromPrompt } from '@/modules/planning/planning-engine';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import { GenerationRun } from '@/types';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

// Bounded execution duration for post-response generation work.
// Note: maxDuration = 60 requires a Vercel Pro or Enterprise plan.
// If deploying on a Vercel Hobby (Free) account, reduce to 15 to avoid deployment build failure.
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

    const body = await req.json().catch(() => ({}));
    let plan = body.plan;

    // If no explicit plan passed, load from DB or synthesize from prompt/description.
    if (!plan) {
      const spec = await db.getSpecification(projectId);

      if (spec) {
        plan = await createPlanFromPrompt(
          projectId,
          project.name,
          spec.description,
          spec
        );
      } else {
        const prompt =
          body.prompt || project.description || 'Full-stack application';

        plan = await createPlanFromPrompt(
          projectId,
          project.name,
          prompt
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
      modelProvider: body.modelProvider || 'deterministic',
      modelIdentifier: 'deterministic-engine-v1',
      attemptCount: 1,
      prompt: body.prompt || project.description,
      startedAt: new Date().toISOString(),
    };

    await db.saveGenerationRun(newRun);
    await db.updateProject(projectId, { status: 'generating' });

    // Schedule bounded post-response generation using Next.js after().
    // Note: after() keeps the serverless execution context alive until the promise resolves,
    // within the configured maxDuration. It is not a durable background queue.
    after(async () => {
      try {
        await ProjectOrchestrator.runFullGeneration(runId, projectId, plan);
      } catch (err) {
        console.error(`Post-response generation failed for run ${runId}:`, err);
      }
    });

    return NextResponse.json({
      success: true,
      runId,
      status: 'queued',
      message: 'Generation run started successfully',
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
