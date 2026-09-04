import { PlaywrightRunner } from './playwright-runner.ts';
import { ScenarioExecutor } from './scenario-executor.ts';
import type { ScenarioAssertionReport } from '../../../tests/benchmark/assertions.ts';

export interface VerificationOptions {
  headless?: boolean;
  timeoutMs?: number;
}

export interface FunctionalVerificationResult {
  scenarioId: string;
  targetUrl: string;
  passed: boolean;
  report: ScenarioAssertionReport;
  durationMs: number;
  browserMode: 'headless_chromium' | 'simulated_dom';
  timestamp: string;
}

/**
 * FunctionalVerificationService: Coordinates Playwright headless browser runs
 * to evaluate live generated application previews independently.
 */
export class FunctionalVerificationService {
  private runner: PlaywrightRunner;

  constructor() {
    this.runner = new PlaywrightRunner();
  }

  /**
   * Executes functional verification for a given scenario against an accessible preview URL.
   */
  async verifyScenario(
    scenarioId: string,
    targetUrl: string,
    options?: VerificationOptions
  ): Promise<FunctionalVerificationResult> {
    const startTime = Date.now();
    await this.runner.launch({ headless: options?.headless ?? true });
    const page = await this.runner.createPage();

    try {
      let report: ScenarioAssertionReport;

      switch (scenarioId) {
        case 'bench_01_saas_landing':
          report = await ScenarioExecutor.executeScenario1DevOpsPulse(page, targetUrl);
          break;
        case 'bench_04_task_management':
          report = await ScenarioExecutor.executeScenario4TaskFlow(page, targetUrl);
          break;
        default:
          throw new Error(`Executable browser assertions not yet implemented for scenario "${scenarioId}"`);
      }

      return {
        scenarioId,
        targetUrl,
        passed: report.passed,
        report,
        durationMs: Date.now() - startTime,
        browserMode: 'headless_chromium',
        timestamp: new Date().toISOString(),
      };
    } finally {
      await this.runner.close();
    }
  }
}
