import { db } from '@/lib/db';
import { ApplicationPlan, ProjectVersion } from '@/types';
import { generateProjectFiles, modifyProjectFiles } from '@/modules/generation/generator';
import { GeminiProvider, isGeminiConfigured } from '@/modules/ai/gemini-provider';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';
import { BoundedRepairLoop } from '@/modules/repair/repair-loop';

// In-memory set of cancelled run IDs for local optimization
const cancelledRuns = new Set<string>();

export class ProjectOrchestrator {
  static cancelRun(runId: string): void {
    cancelledRuns.add(runId);
  }

  /**
   * Asynchronously queries the durable database to determine whether a run has been cancelled.
   * Relies on PostgreSQL (or active DB adapter) as authoritative source of truth.
   */
  static async isCancelled(runId: string): Promise<boolean> {
    if (cancelledRuns.has(runId)) {
      return true;
    }
    const run = await db.getGenerationRun(runId);
    if (run?.status === 'cancelled') {
      cancelledRuns.add(runId);
      return true;
    }
    return false;
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
      if (await this.isCancelled(runId)) {
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

      if (await this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

      // Step 2: Code Generation
      await db.updateGenerationRun(runId, { status: 'generating' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 2,
        eventType: 'step_started',
        message: 'Synthesizing multi-file Next.js application codebase',
      });

      const currentRun = await db.getGenerationRun(runId);
      const useGemini = currentRun?.modelProvider === 'gemini' || (currentRun?.modelProvider !== 'deterministic' && isGeminiConfigured());

      let generatedFiles;
      if (useGemini) {
        const aiResult = await GeminiProvider.generateProject(
          plan,
          plan.specification,
          async (msg, level) => {
            await db.addBuildLog(runId, level || 'stdout', msg);
          }
        );
        generatedFiles = aiResult.files;
        await db.updateGenerationRun(runId, {
          modelProvider: aiResult.modelProvider,
          modelIdentifier: aiResult.modelIdentifier,
          usageMetadata: aiResult.usageMetadata,
          errorCode: aiResult.errorCode,
        });
      } else {
        generatedFiles = await generateProjectFiles(plan, plan.specification);
      }

      for (const f of generatedFiles) {
        await db.addGenerationEvent(runId, {
          generationRunId: runId,
          sequenceNumber: 10,
          eventType: 'file_generated',
          message: `Generated file: ${f.path} (${f.responsibility})`,
          metadata: { path: f.path, sizeBytes: f.sizeBytes },
        });
      }

      if (await this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

      // Step 3: Manifest & Workspace Validation
      await db.updateGenerationRun(runId, { status: 'validating' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 20,
        eventType: 'step_started',
        message: 'Validating manifest integrity and sandbox boundaries',
      });

      // Step 4: Sandbox Build & Syntax Execution
      await db.updateGenerationRun(runId, { status: 'building' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 30,
        eventType: 'step_started',
        message: 'Executing manifest integrity and JSON syntax verification',
      });

      const validation = await SandboxManager.validateAndBuild(projectId, runId, generatedFiles);
      let finalFiles = generatedFiles;

      if (!validation.passed) {
        if (await this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

        await db.updateGenerationRun(runId, { status: 'repairing' });
        const repairResult = await BoundedRepairLoop.attemptRepair(
          projectId,
          runId,
          generatedFiles,
          validation.results
        );
        if (!repairResult.success) {
          if (await this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

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

      if (await this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

      // Step 5: Prepare workspace metadata and authenticated preview renderer
      await db.updateGenerationRun(runId, { status: 'starting' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 40,
        eventType: 'step_started',
        message: 'Preparing workspace snapshot and authenticated preview route',
      });

      const sandboxSession = await SandboxManager.startSandbox(projectId, finalFiles);

      await db.updateGenerationRun(runId, { status: 'preview_ready' });
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 50,
        eventType: 'preview_ready',
        message: 'Authenticated generated preview is available',
        metadata: { previewUrl: sandboxSession.hostUrl, port: sandboxSession.port },
      });

      // Step 6: Atomically publish version snapshot, persist files, and complete run
      const existingVersions = await db.listVersions(projectId);
      const nextVersionNumber = existingVersions.length > 0
        ? Math.max(...existingVersions.map((version) => version.versionNumber)) + 1
        : 1;
      const project = await db.getProject(projectId);
      const versionId = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newVersion: ProjectVersion = {
        id: versionId,
        projectId,
        parentVersionId: project?.activeVersionId,
        versionNumber: nextVersionNumber,
        sourceManifest: finalFiles.map((f) => f.path),
        changeSummary: 'Initial application generation',
        validationStatus: 'passed',
        createdAt: new Date().toISOString(),
      };

      const published = await db.publishVersionIfActive(runId, projectId, newVersion, finalFiles);

      if (!published) {
        // Publication was rejected because the run was cancelled or reached terminal state
        return { success: false, error: 'Run was cancelled by user' };
      }

      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 60,
        eventType: 'step_completed',
        message: 'Application generation and verification complete',
      });

      return { success: true, versionId };
    } catch (err: any) {
      if (await this.isCancelled(runId)) {
        return { success: false, error: 'Run was cancelled by user' };
      }

      console.error(`Orchestrator error for run ${runId}:`, err);
      await db.updateGenerationRun(runId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorCode: 'ORCHESTRATION_ERROR',
        errorMessage: err.message || 'Unknown orchestration error',
      });
      await db.updateProject(projectId, { status: 'error' });
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
      if (await this.isCancelled(runId)) {
        return { success: false, error: 'Run was cancelled by user' };
      }

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

      if (await this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

      // Targeted modification
      const currentRun = await db.getGenerationRun(runId);
      const useGemini = currentRun?.modelProvider === 'gemini' || (currentRun?.modelProvider !== 'deterministic' && isGeminiConfigured());

      let modifiedFiles;
      let changeSummary;

      if (useGemini) {
        const aiResult = await GeminiProvider.modifyProject(
          baseFiles,
          instruction,
          null,
          async (msg, level) => {
            await db.addBuildLog(runId, level || 'stdout', msg);
          }
        );
        modifiedFiles = aiResult.files;
        changeSummary = aiResult.summary || instruction;
        await db.updateGenerationRun(runId, {
          modelProvider: aiResult.modelProvider,
          modelIdentifier: aiResult.modelIdentifier,
          usageMetadata: aiResult.usageMetadata,
          errorCode: aiResult.errorCode,
        });
      } else {
        const mod = await modifyProjectFiles(baseFiles, instruction);
        modifiedFiles = mod.modifiedFiles;
        changeSummary = mod.changeSummary;
      }

      if (await this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

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
        if (await this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

        await db.updateGenerationRun(runId, { status: 'repairing' });
        const repairResult = await BoundedRepairLoop.attemptRepair(
          projectId,
          runId,
          modifiedFiles,
          validation.results
        );
        if (!repairResult.success) {
          if (await this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

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

      if (await this.isCancelled(runId)) return { success: false, error: 'Cancelled' };

      // Update Sandbox
      await SandboxManager.startSandbox(projectId, finalFiles);

      // Atomically publish modified version, persist files, and complete run
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

      const published = await db.publishVersionIfActive(runId, projectId, newVersion, finalFiles);

      if (!published) {
        // Publication was rejected because the run was cancelled or reached terminal state
        return { success: false, error: 'Run was cancelled by user' };
      }

      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 50,
        eventType: 'step_completed',
        message: `Version ${nextVersionNum} published successfully: ${changeSummary}`,
      });

      return { success: true, versionId: newVersionId };
    } catch (err: any) {
      if (await this.isCancelled(runId)) {
        return { success: false, error: 'Run was cancelled by user' };
      }

      console.error(`Modification error for run ${runId}:`, err);
      await db.updateGenerationRun(runId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorMessage: err.message,
      });
      await db.updateProject(projectId, { status: 'error' });
      return { success: false, error: err.message };
    }
  }
}
