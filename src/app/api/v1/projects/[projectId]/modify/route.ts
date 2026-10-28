import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ProjectOrchestrator } from '@/server/jobs/orchestrator';
import { ModifyRequestSchema, GenerationRun } from '@/types';
import { isGeminiConfigured } from '@/modules/ai/gemini-provider';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

// See generate/route.ts: the current in-process workflow must complete before
// returning so it cannot be stranded by a serverless post-response shutdown.
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

    const activeRun = await db.getLatestGenerationRun(projectId);
    if (activeRun && ['queued', 'planning', 'generating', 'validating', 'building', 'repairing', 'starting', 'preview_ready'].includes(activeRun.status)) {
      return NextResponse.json(
        { success: false, error: 'A generation is already in progress for this project', runId: activeRun.id },
        { status: 409 }
      );
    }

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

    const chosenProvider = isGeminiConfigured() ? 'gemini' : 'deterministic';
    const chosenIdentifier = chosenProvider === 'gemini' ? 'gemini-2.0-flash' : 'deterministic-engine-v1';

    const newRun: GenerationRun = {
      id: runId,
      projectId,
      baseVersionId,
      runType: 'modification',
      status: 'queued',
      modelProvider: chosenProvider,
      modelIdentifier: chosenIdentifier,
      attemptCount: 1,
      prompt: parsed.data.instruction,
      startedAt: new Date().toISOString(),
    };

    await db.saveGenerationRun(newRun);
    await db.updateProject(projectId, { status: 'generating' });

    const result = await ProjectOrchestrator.runModification(
      runId,
      projectId,
      parsed.data.instruction,
      baseVersionId
    );
    const run = await db.getGenerationRun(runId);

    return NextResponse.json({
      success: true,
      runId,
      run,
      status: run?.status || (result.success ? 'completed' : 'failed'),
      message: result.success
        ? 'Modification completed successfully'
        : 'Modification failed; inspect the run diagnostics for details',
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
