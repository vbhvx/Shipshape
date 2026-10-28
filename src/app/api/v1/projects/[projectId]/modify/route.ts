import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import { ModifyRequestSchema, GenerationRun } from '@/types';
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

    const body = await req.json();
    const parsed = ModifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid modification instruction',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const baseVersionId =
      parsed.data.baseVersionId || project.activeVersionId;

    if (baseVersionId) {
      const baseVersion = await db.getVersion(baseVersionId);

      if (!baseVersion || baseVersion.projectId !== projectId) {
        return NextResponse.json(
          { success: false, error: 'Base version not found' },
          { status: 404 }
        );
      }
    }

    const runId = `run_mod_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;

    const newRun: GenerationRun = {
      id: runId,
      projectId,
      baseVersionId,
      runType: 'modification',
      status: 'queued',
      modelProvider: 'deterministic',
      modelIdentifier: 'deterministic-engine-v1',
      attemptCount: 1,
      prompt: parsed.data.instruction,
      startedAt: new Date().toISOString(),
    };

    await db.saveGenerationRun(newRun);
    await db.updateProject(projectId, { status: 'generating' });

    // Schedule bounded post-response modification using Next.js after().
    // Note: after() keeps the serverless execution context alive until the promise resolves,
    // within the configured maxDuration. It is not a durable background queue.
    after(async () => {
      try {
        await ProjectOrchestrator.runModification(
          runId,
          projectId,
          parsed.data.instruction,
          baseVersionId
        );
      } catch (err) {
        console.error(`Post-response modification failed for run ${runId}:`, err);
      }
    });

    return NextResponse.json({
      success: true,
      runId,
      status: 'queued',
      message: 'Modification run queued',
    });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }

    console.error('Failed to start project modification:', err);

    return NextResponse.json(
      { success: false, error: 'Failed to start project modification' },
      { status: 500 }
    );
  }
}
