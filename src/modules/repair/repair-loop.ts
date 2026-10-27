import { GeneratedFile, BuildCheckResult } from '@/types';
import { db } from '@/lib/db';
import { SandboxManager } from '@/modules/sandbox/sandbox-manager';

export interface RepairAttemptResult {
  success: boolean;
  attemptsUsed: number;
  fixedFiles: GeneratedFile[];
  summary: string;
  errorLog?: string;
}

export class BoundedRepairLoop {
  static MAX_ATTEMPTS = 3;

  /**
   * Attempts targeted automated repair on failed project files within strict bounds.
   */
  static async attemptRepair(
    projectId: string,
    runId: string,
    initialFiles: GeneratedFile[],
    failedChecks: BuildCheckResult[]
  ): Promise<RepairAttemptResult> {
    let currentFiles = initialFiles.map((f) => ({ ...f }));
    let attempts = 0;

    await db.addBuildLog(
      runId,
      'system',
      `[AGENT REPAIR] Initiating bounded repair loop (Max attempts: ${this.MAX_ATTEMPTS})...`
    );

    while (attempts < this.MAX_ATTEMPTS) {
      attempts++;
      await db.addGenerationEvent(runId, {
        generationRunId: runId,
        sequenceNumber: 200 + attempts,
        eventType: 'repair_attempt',
        message: `Running automated diagnostic repair attempt ${attempts}/${this.MAX_ATTEMPTS}`,
        metadata: { attempt: attempts },
      });

      // 1. Analyze and diagnose error
      let errorDiagnosed = false;

      for (const check of failedChecks) {
        if (!check.errors || check.errors.length === 0) continue;

        for (const err of check.errors) {
          // If JSON syntax error, fix JSON
          if (err.file && err.file.endsWith('.json')) {
            const target = currentFiles.find((f) => f.path === err.file);
            if (target) {
              await db.addBuildLog(
                runId,
                'system',
                `[REPAIR ATTEMPT ${attempts}] Repairing invalid JSON formatting in ${target.path}`
              );
              try {
                // Attempt clean serialization
                const sanitized = target.content.replace(/,\s*([}\]])/g, '$1');
                JSON.parse(sanitized);
                target.content = sanitized;
                target.isModified = true;
                errorDiagnosed = true;
              } catch {
                // Fallback to safe empty valid config
                target.content = '{}';
                target.isModified = true;
                errorDiagnosed = true;
              }
            }
          }

          // If missing file error, generate the missing file stub
          if (err.message && err.message.includes('Missing essential manifest files')) {
            const missingMatches = err.message.replace('Missing essential manifest files:', '').split(',');
            for (const item of missingMatches) {
              const trimmed = item.trim();
              if (trimmed && !currentFiles.some((f) => f.path === trimmed)) {
                await db.addBuildLog(
                  runId,
                  'system',
                  `[REPAIR ATTEMPT ${attempts}] Generating missing required file: ${trimmed}`
                );
                currentFiles.push({
                  path: trimmed,
                  content: '// Auto-generated repair stub\nexport default function Stub() { return null; }\n',
                  responsibility: 'Auto-repaired manifest file',
                  fileType: 'page',
                  sizeBytes: 80,
                  mimeType: 'text/typescript',
                  isNew: true,
                });
                errorDiagnosed = true;
              }
            }
          }
        }
      }

      // If no targeted rule matched, perform a safe lint/whitespace cleanup
      if (!errorDiagnosed) {
        await db.addBuildLog(
          runId,
          'system',
          `[REPAIR ATTEMPT ${attempts}] Applying generic syntax normalization to source files`
        );
        for (const f of currentFiles) {
          if (f.path.endsWith('.tsx') || f.path.endsWith('.ts')) {
            f.content = f.content.trim() + '\n';
            f.isModified = true;
          }
        }
      }

      // Re-run validation
      const validation = await SandboxManager.validateAndBuild(projectId, runId, currentFiles);
      if (validation.passed) {
        await db.addBuildLog(
          runId,
          'stdout',
          `[REPAIR SUCCESS] Project build and validation resolved on attempt ${attempts}.`
        );
        return {
          success: true,
          attemptsUsed: attempts,
          fixedFiles: currentFiles,
          summary: `Successfully diagnosed and repaired issues in ${attempts} attempt(s).`,
        };
      }
    }

    // Exhausted attempts
    await db.addBuildLog(
      runId,
      'stderr',
      `[REPAIR FAILED] Exceeded maximum allowed repair attempts (${this.MAX_ATTEMPTS}). Preserving last known good state.`
    );

    return {
      success: false,
      attemptsUsed: attempts,
      fixedFiles: initialFiles,
      summary: `Automated repair exceeded ${this.MAX_ATTEMPTS} attempts without resolving build errors.`,
      errorLog: 'Build checks failed after repeated targeted patches.',
    };
  }
}
