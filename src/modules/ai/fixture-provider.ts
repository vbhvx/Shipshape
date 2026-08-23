import { ApplicationPlan, GeneratedFile, ProjectSpecification } from '@/types';
import { modifyProjectFiles } from '@/modules/generation/generator';
import {
  DEVOPS_PULSE_FIXTURE,
  TASKFLOW_KANBAN_FIXTURE,
  getFixtureById,
  getFixtureForScenario,
  type ModelFixture,
} from './fixtures';
import type { IModelProvider, ModelProviderOptions, ModelProviderResult } from './model-provider';

/**
 * FixtureModelProvider
 *
 * Implements deterministic model replay for hermetic evaluation and offline CI testing.
 * Replays realistic, schema-validated model outputs with full token usage metadata,
 * ensuring no dependence on live API quotas or external network connectivity while
 * testing real Docker compilation, Turbopack builds, and Playwright verification.
 */
export class FixtureModelProvider implements IModelProvider {
  readonly providerType = 'fixture' as const;

  constructor(private readonly defaultFixtureId?: string) {}

  async generateProject(
    plan: ApplicationPlan,
    specification: ProjectSpecification,
    options?: ModelProviderOptions | ((msg: string, level?: any) => Promise<void>),
    signal?: AbortSignal
  ): Promise<ModelProviderResult> {
    let onLog: ((msg: string, level?: 'stdout' | 'stderr' | 'system') => Promise<void> | void) | undefined;
    let sig = signal;
    let requestedFixtureId = this.defaultFixtureId;
    let scenarioId: string | undefined;

    if (typeof options === 'function') {
      onLog = options;
    } else if (options) {
      onLog = options.onLog;
      sig = options.signal || signal;
      requestedFixtureId = options.fixtureId || requestedFixtureId;
      scenarioId = options.scenarioId;
    }

    if (sig?.aborted) {
      const cancelErr: any = new Error('Generation cancelled by user');
      cancelErr.isCancelled = true;
      cancelErr.name = 'AbortError';
      throw cancelErr;
    }

    // Resolve fixture
    let fixture: ModelFixture | undefined;

    if (requestedFixtureId) {
      fixture = getFixtureById(requestedFixtureId);
    }

    if (!fixture && scenarioId) {
      fixture = getFixtureForScenario(scenarioId);
    }

    if (!fixture && (plan as any)?.scenarioId) {
      fixture = getFixtureForScenario((plan as any).scenarioId);
    }

    if (!fixture && specification?.id) {
      fixture = getFixtureForScenario(specification.id);
    }

    if (!fixture) {
      const combinedText = `${specification?.name || ''} ${specification?.description || ''} ${plan?.specification?.name || ''}`.toLowerCase();
      if (combinedText.includes('kanban') || combinedText.includes('taskflow') || combinedText.includes('task management')) {
        fixture = TASKFLOW_KANBAN_FIXTURE;
      } else {
        fixture = DEVOPS_PULSE_FIXTURE;
      }
    }

    if (onLog) {
      await onLog(`[AI REPLAY] Replaying deterministic model fixture: ${fixture.name} (${fixture.id})`, 'stdout');
    }

    const files: GeneratedFile[] = fixture.files.map((f) => ({
      path: f.path,
      responsibility: f.responsibility,
      fileType: f.fileType,
      content: f.content,
      sizeBytes: Buffer.byteLength(f.content, 'utf-8'),
      mimeType: f.path.endsWith('.css')
        ? 'text/css'
        : f.path.endsWith('.json')
        ? 'application/json'
        : 'text/typescript',
      isNew: true,
      isModified: false,
    }));

    return {
      success: true,
      files,
      summary: fixture.summary,
      modelIdentifier: fixture.id,
      modelProvider: 'fixture',
      fixtureId: fixture.id,
      usageMetadata: {
        tokens: fixture.usageMetadata.totalTokens,
        filesCount: files.length,
        durationMs: fixture.usageMetadata.durationMs,
        promptTokens: fixture.usageMetadata.promptTokens,
        candidatesTokens: fixture.usageMetadata.candidatesTokens,
        totalTokens: fixture.usageMetadata.totalTokens,
        isSyntheticTokenCount: true,
      },
      fallbackUsed: false,
    };
  }

  async modifyProject(
    baseFiles: GeneratedFile[],
    instruction: string,
    specification?: ProjectSpecification | null,
    options?: ModelProviderOptions | ((msg: string, level?: any) => Promise<void>),
    signal?: AbortSignal
  ): Promise<ModelProviderResult> {
    let onLog: ((msg: string, level?: 'stdout' | 'stderr' | 'system') => Promise<void> | void) | undefined;
    let sig = signal;
    let requestedFixtureId = this.defaultFixtureId;

    if (typeof options === 'function') {
      onLog = options;
    } else if (options) {
      onLog = options.onLog;
      sig = options.signal || signal;
      requestedFixtureId = options.fixtureId || requestedFixtureId;
    }

    if (sig?.aborted) {
      const cancelErr: any = new Error('Modification cancelled by user');
      cancelErr.isCancelled = true;
      cancelErr.name = 'AbortError';
      throw cancelErr;
    }

    if (onLog) {
      await onLog(`[AI REPLAY] Replaying deterministic modification fixture: "${instruction}"`, 'stdout');
    }

    const { modifiedFiles, changeSummary } = await modifyProjectFiles(baseFiles, instruction);

    return {
      success: true,
      files: modifiedFiles,
      summary: changeSummary || `Replayed modification: ${instruction}`,
      modelIdentifier: requestedFixtureId || 'fixture_modification_v1',
      modelProvider: 'fixture',
      fixtureId: requestedFixtureId,
      usageMetadata: {
        tokens: 1650,
        filesCount: modifiedFiles.length,
        durationMs: 750,
        promptTokens: 450,
        candidatesTokens: 1200,
        totalTokens: 1650,
        isSyntheticTokenCount: true,
      },
      fallbackUsed: false,
    };
  }
}

