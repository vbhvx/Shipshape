import { db } from '@/lib/db';
import { ApplicationPlan, GeneratedFile, ProjectVersion } from '@/types';
import { generateProjectFiles, modifyProjectFiles } from '@/modules/generation/generator';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';
import { BoundedRepairLoop } from '@/modules/repair/repair-loop';
import { computeVersionDiff } from '@/modules/versioning/diff-engine';

// In-memory set of cancelled run IDs
const cancelledRuns = new Set<string>();

export class ProjectOrchestrator {
  static cancelRun(runId: string): void {
    cancelledRuns.add(runId);
  }

  static isCancelled(runId: string): boolean {
    return cancelledRuns.has(runId);
  }

  /**
   * Executes the full generation lifecycle for a new project or initial version.
   */
  static async runFullGeneration(
    runId: string,
    projectId: string,
    plan: ApplicationPlan
  ): Promise<{ success: boolean; versionId?: string; error?: string }> {
    try {
      if (this.isCancelled(runId)) {
        await this.markCancelled(runId);
        return { success: false, error: 'Run was cancelled by user' };
      }

      // Step 1: Planning Confirmed
      await db.updateGenerationRun(runId, { status: 'planning' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 1,
        eventType: 'step_started',
        message: 'Interpreting requirements and validating application plan',
      });
      await db.addBuildLog(runId, 'system', '[ORCHESTRATOR] Initializing structured application generation...');

      if (this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

      // Step 2: Code Generation
      await db.updateGenerationRun(runId, { status: 'generating' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 2,
        eventType: 'step_started',
        message: 'Synthesizing multi-file Next.js application codebase',
      });

      const generatedFiles = await generateProjectFiles(plan, plan.specification);
      for (const f of generatedFiles) {
        await db.addGenerationEvent(runId, {
          generationRunId: runId,
          sequenceNumber: 10,
          eventType: 'file_generated',
          message: `Generated file: ${f.path} (${f.responsibility})`,
          metadata: { path: f.path, sizeBytes: f.sizeBytes },
        });
      }

      if (this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

      // Step 3: Manifest & Workspace Validation
      await db.updateGenerationRun(runId, { status: 'validating' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 20,
        eventType: 'step_started',
        message: 'Validating manifest integrity and sandbox boundaries',
      });

      // Step 4: Sandbox Build Execution
      await db.updateGenerationRun(runId, { status: 'building' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 30,
        eventType: 'step_started',
        message: 'Executing isolated TypeScript check and Turbopack build',
      });

      let validation = await SandboxManager.validateAndBuild(projectId, runId, generatedFiles);
      let finalFiles = generatedFiles;

      if (!validation.passed) {
        await db.updateGenerationRun(runId, { status: 'repairing' });
        const repairResult = await BoundedRepairLoop.attemptRepair(
          projectId,
          runId,
          generatedFiles,
          validation.results
        );
        if (!repairResult.success) {
          await db.updateGenerationRun(runId, {
            status: 'failed',
            finishedAt: new Date().toISOString(),
            errorCode: 'BUILD_FAILED',
            errorMessage: repairResult.summary,
          });
          return { success: false, error: repairResult.summary };
        }
        finalFiles = repairResult.fixedFiles;
      }

      if (this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

      // Step 5: Start Sandbox Runtime & Live Preview
      await db.updateGenerationRun(runId, { status: 'starting' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 40,
        eventType: 'step_started',
        message: 'Spinning up isolated sandbox server and preview proxy',
      });

      const sandboxSession = await SandboxManager.startSandbox(projectId, finalFiles);

      await db.updateGenerationRun(runId, { status: 'preview_ready' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 50,
        eventType: 'preview_ready',
        message: 'Live preview is now running and isolated',
        metadata: { previewUrl: sandboxSession.hostUrl, port: sandboxSession.port },
      });

      // Step 6: Create Version Snapshot & Persist Files
      const versionId = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newVersion: ProjectVersion = {
        id: versionId,
        projectId,
        versionNumber: 1,
        sourceManifest: finalFiles.map((f) => f.path),
        changeSummary: 'Initial application generation',
        validationStatus: 'passed',
        createdAt: new Date().toISOString(),
      };

      await db.saveVersion(newVersion);
      await db.saveFiles(projectId, versionId, finalFiles);
      await db.updateProject(projectId, {
        activeVersionId: versionId,
        status: 'running',
      });

      await db.updateGenerationRun(runId, {
        status: 'completed',
        resultVersionId: versionId,
        finishedAt: new Date().toISOString(),
      });

      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 60,
        eventType: 'step_completed',
        message: 'Application generation and verification complete',
      });

      return { success: true, versionId };
    } catch (err: any) {
      console.error(`Orchestrator error for run ${runId}:`, err);
      await db.updateGenerationRun(runId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorCode: 'ORCHESTRATION_ERROR',
        errorMessage: err.message || 'Unknown orchestration error',
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Executes an iterative modification on an existing project version.
   */
  static async runModification(
    runId: string,
    projectId: string,
    instruction: string,
    baseVersionId?: string
  ): Promise<{ success: boolean; versionId?: string; error?: string }> {
    try {
      const project = await db.getProject(projectId);
      if (!project) throw new Error('Project not found');

      const targetBaseVersionId = baseVersionId || project.activeVersionId;
      if (!targetBaseVersionId) throw new Error('No base version available to modify');

      const baseFiles = await db.getFilesForVersion(projectId, targetBaseVersionId);
      const allVersions = await db.listVersions(projectId);
      const nextVersionNum = allVersions.length > 0 ? Math.max(...allVersions.map((v) => v.versionNumber)) + 1 : 1;

      await db.updateGenerationRun(runId, { status: 'generating' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 1,
        eventType: 'step_started',
        message: `Analyzing instruction: "${instruction}"`,
      });

      // Targeted modification
      const { modifiedFiles, changeSummary } = await modifyProjectFiles(baseFiles, instruction);

      await db.updateGenerationRun(runId, { status: 'validating' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 10,
        eventType: 'step_started',
        message: 'Validating updated code manifest and syntax',
      });

      // Build & Validation
      await db.updateGenerationRun(runId, { status: 'building' });
      const validation = await SandboxManager.validateAndBuild(projectId, runId, modifiedFiles);
      let finalFiles = modifiedFiles;

      if (!validation.passed) {
        await db.updateGenerationRun(runId, { status: 'repairing' });
        const repairResult = await BoundedRepairLoop.attemptRepair(
          projectId,
          runId,
          modifiedFiles,
          validation.results
        );
        if (!repairResult.success) {
          await db.updateGenerationRun(runId, {
            status: 'failed',
            finishedAt: new Date().toISOString(),
            errorCode: 'MODIFICATION_BUILD_FAILED',
            errorMessage: repairResult.summary,
          });
          return { success: false, error: repairResult.summary };
        }
        finalFiles = repairResult.fixedFiles;
      }

      // Update Sandbox
      await SandboxManager.startSandbox(projectId, finalFiles);

      // Save New Version
      const newVersionId = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newVersion: ProjectVersion = {
        id: newVersionId,
        projectId,
        parentVersionId: targetBaseVersionId,
        versionNumber: nextVersionNum,
        sourceManifest: finalFiles.map((f) => f.path),
        changeSummary,
        validationStatus: 'passed',
        createdAt: new Date().toISOString(),
      };

      await db.saveVersion(newVersion);
      await db.saveFiles(projectId, newVersionId, finalFiles);
      await db.updateProject(projectId, {
        activeVersionId: newVersionId,
        status: 'running',
      });

      await db.updateGenerationRun(runId, {
        status: 'completed',
        resultVersionId: newVersionId,
        finishedAt: new Date().toISOString(),
      });

      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 50,
        eventType: 'step_completed',
        message: `Version ${nextVersionNum} published successfully: ${changeSummary}`,
      });

      return { success: true, versionId: newVersionId };
    } catch (err: any) {
      console.error(`Modification error for run ${runId}:`, err);
      await db.updateGenerationRun(runId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorMessage: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  private static async markCancelled(runId: string): Promise<void> {
    await db.updateGenerationRun(runId, {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
    });
    await db.addGenerationEvent(runId, {
      generationRunId: runId,
      sequenceNumber: 999,
      eventType: 'error',
      message: 'Run was cancelled by user',
    });
  }
}
