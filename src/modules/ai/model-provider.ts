import { ApplicationPlan, GeneratedFile, ProjectSpecification } from '@/types';
import { GeminiProvider, isGeminiConfigured } from './gemini-provider';
import { generateProjectFiles, modifyProjectFiles } from '@/modules/generation/generator';
import { FixtureModelProvider } from './fixture-provider';

export type ModelProviderType = 'gemini' | 'fixture' | 'deterministic';

export interface ModelProviderOptions {
  onLog?: (msg: string, level?: 'stdout' | 'stderr' | 'system') => Promise<void> | void;
  signal?: AbortSignal;
  fixtureId?: string;
  scenarioId?: string;
}

export interface ModelProviderResult {
  success: boolean;
  files: GeneratedFile[];
  summary?: string;
  modelIdentifier: string;
  modelProvider: ModelProviderType;
  usageMetadata?: {
    tokens?: number;
    filesCount?: number;
    durationMs?: number;
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
    thoughtTokens?: number;
    isSyntheticTokenCount?: boolean;
  };
  error?: string;
  errorCode?: string;
  fallbackUsed?: boolean;
  fixtureId?: string;
}

export interface IModelProvider {
  readonly providerType: ModelProviderType;
  generateProject(
    plan: ApplicationPlan,
    specification: ProjectSpecification,
    options?: ModelProviderOptions | ((msg: string, level?: any) => Promise<void>),
    signal?: AbortSignal
  ): Promise<ModelProviderResult>;
  modifyProject(
    baseFiles: GeneratedFile[],
    instruction: string,
    specification?: ProjectSpecification | null,
    options?: ModelProviderOptions | ((msg: string, level?: any) => Promise<void>),
    signal?: AbortSignal
  ): Promise<ModelProviderResult>;
}

export class GeminiModelProvider implements IModelProvider {
  readonly providerType = 'gemini' as const;

  async generateProject(
    plan: ApplicationPlan,
    specification: ProjectSpecification,
    options?: ModelProviderOptions | ((msg: string, level?: any) => Promise<void>),
    signal?: AbortSignal
  ): Promise<ModelProviderResult> {
    let onLog: ((msg: string, level?: 'stdout' | 'stderr' | 'system') => Promise<void>) | undefined;
    let sig = signal;

    if (typeof options === 'function') {
      onLog = options;
    } else if (options) {
      if (options.onLog) {
        const origOnLog = options.onLog;
        onLog = async (msg, level) => {
          await origOnLog(msg, level);
        };
      }
      sig = options.signal || signal;
    }

    const result = await GeminiProvider.generateProject(plan, specification, onLog, sig);
    return {
      ...result,
      modelProvider: result.modelProvider as ModelProviderType,
    };
  }

  async modifyProject(
    baseFiles: GeneratedFile[],
    instruction: string,
    specification?: ProjectSpecification | null,
    options?: ModelProviderOptions | ((msg: string, level?: any) => Promise<void>),
    signal?: AbortSignal
  ): Promise<ModelProviderResult> {
    let onLog: ((msg: string, level?: 'stdout' | 'stderr' | 'system') => Promise<void>) | undefined;
    let sig = signal;

    if (typeof options === 'function') {
      onLog = options;
    } else if (options) {
      if (options.onLog) {
        const origOnLog = options.onLog;
        onLog = async (msg, level) => {
          await origOnLog(msg, level);
        };
      }
      sig = options.signal || signal;
    }

    const result = await GeminiProvider.modifyProject(baseFiles, instruction, specification, onLog, sig);
    return {
      ...result,
      modelProvider: result.modelProvider as ModelProviderType,
    };
  }
}

export class DeterministicModelProvider implements IModelProvider {
  readonly providerType = 'deterministic' as const;

  async generateProject(
    plan: ApplicationPlan,
    specification: ProjectSpecification,
    options?: ModelProviderOptions | ((msg: string, level?: any) => Promise<void>),
    signal?: AbortSignal
  ): Promise<ModelProviderResult> {
    let onLog: ((msg: string, level?: 'stdout' | 'stderr' | 'system') => Promise<void> | void) | undefined;
    let sig = signal;

    if (typeof options === 'function') {
      onLog = options;
    } else if (options) {
      onLog = options.onLog;
      sig = options.signal || signal;
    }

    if (sig?.aborted) {
      const cancelErr: any = new Error('Generation cancelled by user');
      cancelErr.isCancelled = true;
      cancelErr.name = 'AbortError';
      throw cancelErr;
    }

    if (onLog) {
      await onLog('[AI PROVIDER] Using deterministic domain catalog engine.', 'system');
    }

    const startTime = Date.now();
    const files = await generateProjectFiles(plan, specification);
    const durationMs = Date.now() - startTime;

    return {
      success: true,
      files,
      summary: 'Generated using Shipshape deterministic domain catalog',
      modelIdentifier: 'deterministic-engine-v1',
      modelProvider: 'deterministic',
      usageMetadata: {
        tokens: 0,
        filesCount: files.length,
        durationMs,
        isSyntheticTokenCount: false,
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

    if (typeof options === 'function') {
      onLog = options;
    } else if (options) {
      onLog = options.onLog;
      sig = options.signal || signal;
    }

    if (sig?.aborted) {
      const cancelErr: any = new Error('Modification cancelled by user');
      cancelErr.isCancelled = true;
      cancelErr.name = 'AbortError';
      throw cancelErr;
    }

    if (onLog) {
      await onLog(`[AI PROVIDER] Applying deterministic modification: "${instruction}"`, 'system');
    }

    const startTime = Date.now();
    const { modifiedFiles, changeSummary } = await modifyProjectFiles(baseFiles, instruction);
    const durationMs = Date.now() - startTime;

    return {
      success: true,
      files: modifiedFiles,
      summary: changeSummary,
      modelIdentifier: 'deterministic-engine-v1',
      modelProvider: 'deterministic',
      usageMetadata: {
        tokens: 0,
        filesCount: modifiedFiles.length,
        durationMs,
        isSyntheticTokenCount: false,
      },
      fallbackUsed: false,
    };
  }
}

export { FixtureModelProvider };

/**
 * Factory for obtaining a ModelProvider instance based on providerType or environment.
 */
export function getModelProvider(
  providerType?: string,
  defaultFixtureId?: string
): IModelProvider {
  // Safeguard: Fixture mode cannot accidentally become the production default
  const isProd = process.env.NODE_ENV === 'production';
  const allowFixtures = !isProd || process.env.SHIPSHAPE_ALLOW_FIXTURES === 'true';

  if ((providerType === 'fixture' || process.env.SHIPSHAPE_MODEL_PROVIDER === 'fixture') && allowFixtures) {
    return new FixtureModelProvider(defaultFixtureId);
  }

  if (providerType === 'deterministic') {
    return new DeterministicModelProvider();
  }

  if (providerType === 'gemini') {
    return new GeminiModelProvider();
  }

  if (isGeminiConfigured()) {
    return new GeminiModelProvider();
  }

  return new DeterministicModelProvider();
}
