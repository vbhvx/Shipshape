import { z } from 'zod';

export const VerificationTaxonomySchema = z.enum([
  'contract_validated',          // Benchmark specification is valid
  'simulation_browser_verified', // Simulation harness passed browser assertions
  'container_build_passed',      // Actual generated application compiled in Docker
  'container_preview_ready',     // Actual generated application server became accessible
  'sandbox_browser_verified',    // Actual application passed browser assertions
  'repair_converged',            // A detected failure was repaired and retested successfully
]);

export type VerificationTaxonomyStatus = z.infer<typeof VerificationTaxonomySchema>;

export const BenchmarkEventTypeSchema = z.enum([
  'prompt_submission',
  'initial_ui_feedback',             // T0: Initial UI acknowledgment / skeleton
  'ai_generation_completed',          // LLM generation finished
  'simulated_preview_ready',         // In-memory HTML simulation ready
  'sandbox_provisioned',             // Isolated container / directory created
  'cold_sandbox_startup',            // Cold container image pull and initialization
  'warm_sandbox_startup',            // Warm pre-cached container initialization
  'dependency_installation_completed',// npm ci / dependencies cached
  'compilation_completed',           // T2: Real Next.js build / typecheck succeeded
  'dev_server_ready',                // Next.js dev or prod server listening on port
  'browser_preview_ready',           // T1: Real running application visible in browser
  'functional_verification_completed',// T3: Headless functional acceptance tests passed
  'repair_attempt',                  // Bounded repair cycle triggered
  'terminal_failure',                // Fatal unrecoverable failure
  'run_cancelled',                   // User-initiated or benchmark-driven cancellation
]);

export type BenchmarkEventType = z.infer<typeof BenchmarkEventTypeSchema>;

export const BenchmarkEventSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  runId: z.string(),
  eventType: BenchmarkEventTypeSchema,
  timestampMs: z.number(),
  durationFromStartMs: z.number(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type BenchmarkEvent = z.infer<typeof BenchmarkEventSchema>;

export const ScenarioMetricsReportSchema = z.object({
  scenarioId: z.string(),
  category: z.string(),
  runId: z.string(),
  success: z.boolean(),
  terminalState: z.enum(['completed', 'failed', 'cancelled']),
  verificationStatus: VerificationTaxonomySchema,

  // Latency Milestones (ms from prompt_submission)
  t0_initialFeedbackMs: z.number().nullable(),     // T0: UI feedback
  t1_simulatedPreviewMs: z.number().nullable(),    // In-memory simulation
  t1_realBrowserPreviewMs: z.number().nullable(),  // T1: Genuine running preview
  t2_compilationMs: z.number().nullable(),         // T2: Real compilation
  t3_functionalVerificationMs: z.number().nullable(), // T3: End-to-end tests passed

  // Resource & Token Accounting
  tokenUsage: z.object({
    promptTokens: z.number(),
    candidatesTokens: z.number(),
    thoughtTokens: z.number(),
    totalTokens: z.number(),
  }),
  computeUsage: z.object({
    coldStartupMs: z.number().optional(),
    warmStartupMs: z.number().optional(),
    sandboxProvisionMs: z.number(),
    dependencyInstallMs: z.number(),
    compileBuildMs: z.number(),
    serverStartupMs: z.number().optional(),
    browserVerificationMs: z.number().optional(),
    totalComputeDurationMs: z.number(),
  }),

  // Economics
  cost: z.object({
    aiInferenceUsd: z.number(),
    computeUsd: z.number(),
    totalUsd: z.number(),
  }),

  // Reliability & Repairs
  repairAttempts: z.number(),
  repairConvergence: z.boolean(),
  failureReason: z.string().optional(),
});

export type ScenarioMetricsReport = z.infer<typeof ScenarioMetricsReportSchema>;

// Standard rate table (Gemini Flash + Cloud Compute benchmarks)
export const PRICING_RATES = {
  geminiFlash: {
    promptPerMillion: 0.10,      // $0.10 / 1M prompt tokens
    candidatePerMillion: 0.40,   // $0.40 / 1M candidate tokens
  },
  sandboxCompute: {
    costPerSecond: 0.00002,      // ~$0.072 / hour for microVM container
  },
};

export class BenchmarkMetricsCollector {
  readonly scenarioId: string;
  readonly runId: string;
  private events: BenchmarkEvent[] = [];
  private startTimeMs: number;

  constructor(scenarioId: string, runId: string) {
    this.scenarioId = scenarioId;
    this.runId = runId;
    this.startTimeMs = Date.now();
    this.record('prompt_submission');
  }

  record(eventType: BenchmarkEventType, metadata?: Record<string, any>): BenchmarkEvent {
    const now = Date.now();
    const event: BenchmarkEvent = {
      id: `evt_${now}_${Math.random().toString(36).substring(2, 6)}`,
      scenarioId: this.scenarioId,
      runId: this.runId,
      eventType,
      timestampMs: now,
      durationFromStartMs: Math.max(0, now - this.startTimeMs),
      metadata,
    };
    this.events.push(event);
    return event;
  }

  getEvents(): BenchmarkEvent[] {
    return [...this.events];
  }

  getEvent(eventType: BenchmarkEventType): BenchmarkEvent | undefined {
    return this.events.find((e) => e.eventType === eventType);
  }

  /**
   * Computes a structured ScenarioMetricsReport with explicit separation of
   * simulated preview vs. genuine running preview timings.
   */
  finalize(
    category: string,
    success: boolean,
    terminalState: 'completed' | 'failed' | 'cancelled',
    options?: {
      verificationStatus?: VerificationTaxonomyStatus;
      tokens?: { promptTokens?: number; candidatesTokens?: number; thoughtTokens?: number; totalTokens?: number };
      compute?: {
        coldStartupMs?: number;
        warmStartupMs?: number;
        sandboxProvisionMs?: number;
        dependencyInstallMs?: number;
        compileBuildMs?: number;
        serverStartupMs?: number;
        browserVerificationMs?: number;
      };
      failureReason?: string;
    }
  ): ScenarioMetricsReport {
    const t0Event = this.getEvent('initial_ui_feedback');
    const simPreviewEvent = this.getEvent('simulated_preview_ready');
    const realPreviewEvent = this.getEvent('browser_preview_ready');
    const t2Event = this.getEvent('compilation_completed');
    const t3Event = this.getEvent('functional_verification_completed');

    const promptTokens = options?.tokens?.promptTokens || 0;
    const candidatesTokens = options?.tokens?.candidatesTokens || 0;
    const thoughtTokens = options?.tokens?.thoughtTokens || 0;
    const totalTokens = options?.tokens?.totalTokens || (promptTokens + candidatesTokens + thoughtTokens);

    const aiCost =
      (promptTokens / 1_000_000) * PRICING_RATES.geminiFlash.promptPerMillion +
      (candidatesTokens / 1_000_000) * PRICING_RATES.geminiFlash.candidatePerMillion;

    const sandboxProvisionMs = options?.compute?.sandboxProvisionMs || 0;
    const dependencyInstallMs = options?.compute?.dependencyInstallMs || 0;
    const compileBuildMs = options?.compute?.compileBuildMs || 0;
    const totalComputeDurationMs = sandboxProvisionMs + dependencyInstallMs + compileBuildMs;

    const computeCost = (totalComputeDurationMs / 1000) * PRICING_RATES.sandboxCompute.costPerSecond;

    const repairEvents = this.events.filter((e) => e.eventType === 'repair_attempt');

    let inferredStatus: VerificationTaxonomyStatus = 'contract_validated';
    if (options?.verificationStatus) {
      inferredStatus = options.verificationStatus;
    } else if (realPreviewEvent && t3Event && success) {
      inferredStatus = 'sandbox_browser_verified';
    } else if (simPreviewEvent && t3Event && success) {
      inferredStatus = 'simulation_browser_verified';
    } else if (t2Event && success) {
      inferredStatus = 'container_build_passed';
    }

    return {
      scenarioId: this.scenarioId,
      category,
      runId: this.runId,
      success,
      terminalState,
      verificationStatus: inferredStatus,
      t0_initialFeedbackMs: t0Event ? t0Event.durationFromStartMs : null,
      t1_simulatedPreviewMs: simPreviewEvent ? simPreviewEvent.durationFromStartMs : null,
      t1_realBrowserPreviewMs: realPreviewEvent ? realPreviewEvent.durationFromStartMs : null,
      t2_compilationMs: t2Event ? t2Event.durationFromStartMs : null,
      t3_functionalVerificationMs: t3Event ? t3Event.durationFromStartMs : null,
      tokenUsage: {
        promptTokens,
        candidatesTokens,
        thoughtTokens,
        totalTokens,
      },
      computeUsage: {
        coldStartupMs: options?.compute?.coldStartupMs,
        warmStartupMs: options?.compute?.warmStartupMs,
        sandboxProvisionMs,
        dependencyInstallMs,
        compileBuildMs,
        serverStartupMs: options?.compute?.serverStartupMs,
        browserVerificationMs: options?.compute?.browserVerificationMs,
        totalComputeDurationMs,
      },
      cost: {
        aiInferenceUsd: Number(aiCost.toFixed(6)),
        computeUsd: Number(computeCost.toFixed(6)),
        totalUsd: Number((aiCost + computeCost).toFixed(6)),
      },
      repairAttempts: repairEvents.length,
      repairConvergence: repairEvents.length > 0 ? success : true,
      failureReason: options?.failureReason,
    };
  }

  /**
   * Calculates the true economic metric:
   * Cost per successful application = (Total cost of all attempts) / (Number of successfully verified applications)
   * Accounting for the cost of failed attempts, retries, and repair loops.
   */
  static calculateCostPerSuccess(reports: ScenarioMetricsReport[]): {
    totalCostUsd: number;
    successfulCount: number;
    costPerSuccessUsd: number;
  } {
    const totalCost = reports.reduce((acc, r) => acc + r.cost.totalUsd, 0);
    const successfulCount = reports.filter((r) => r.success && (r.verificationStatus === 'sandbox_browser_verified' || r.verificationStatus === 'simulation_browser_verified')).length;
    return {
      totalCostUsd: Number(totalCost.toFixed(6)),
      successfulCount,
      costPerSuccessUsd: successfulCount > 0 ? Number((totalCost / successfulCount).toFixed(6)) : totalCost,
    };
  }
}
