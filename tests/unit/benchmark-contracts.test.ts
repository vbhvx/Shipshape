import { describe, it, expect } from 'vitest';
import {
  BENCHMARK_SCENARIOS,
  BenchmarkScenarioSchema,
  BenchmarkCategory,
} from '../benchmark/scenarios';
import {
  BenchmarkAssertionRunner,
  resolveSemanticQuery,
  evaluateHorizontalOverflow,
  verifyPersistenceIntegrity,
} from '../benchmark/assertions';
import {
  BenchmarkMetricsCollector,
} from '../benchmark/metrics';

describe('Phase 4 — Benchmark Scenarios & Acceptance Contract', () => {
  describe('Deliverable 1: Scenario Schema & Coverage', () => {
    it('contains exactly 10 distinct scenario specifications', () => {
      expect(BENCHMARK_SCENARIOS.length).toBe(10);
    });

    it('all 10 scenarios strictly conform to BenchmarkScenarioSchema', () => {
      for (const scenario of BENCHMARK_SCENARIOS) {
        const parsed = BenchmarkScenarioSchema.safeParse(scenario);
        expect(parsed.success, `Scenario ${scenario.id} failed validation: ${parsed.error?.message}`).toBe(true);
      }
    });

    it('covers all 4 required evaluation categories with designated distribution', () => {
      const counts: Record<BenchmarkCategory, number> = {
        application_generation: 0,
        modification_and_regression: 0,
        error_recovery: 0,
        cancellation_and_lifecycle: 0,
      };

      for (const s of BENCHMARK_SCENARIOS) {
        counts[s.category]++;
      }

      expect(counts.application_generation).toBe(7);
      expect(counts.modification_and_regression).toBe(1);
      expect(counts.error_recovery).toBe(1);
      expect(counts.cancellation_and_lifecycle).toBe(1);
    });

    it('verifies all scenarios have unique IDs, prompts, and budgets', () => {
      const ids = new Set<string>();
      for (const s of BENCHMARK_SCENARIOS) {
        expect(ids.has(s.id), `Duplicate scenario ID: ${s.id}`).toBe(false);
        ids.add(s.id);

        expect(s.prompt.length).toBeGreaterThan(20);
        expect(s.targetRoutes.length).toBeGreaterThan(0);
        expect(s.functionalAcceptanceCriteria.length).toBeGreaterThan(0);
        expect(s.assertions.length).toBeGreaterThan(0);
        expect(s.budgets.maxT0Ms).toBeGreaterThan(0);
        expect(s.budgets.maxT1Ms).toBeGreaterThan(0);
        expect(s.budgets.maxT2Ms).toBeGreaterThan(0);
        expect(s.budgets.maxT3Ms).toBeGreaterThan(0);
      }
    });
  });

  describe('Deliverable 2 & 3: Assertion Architecture & Initial Executable Scenarios', () => {
    it('correctly resolves semantic queries prioritizing accessible roles and names', () => {
      const roleStep = resolveSemanticQuery({
        id: 'step_1',
        description: 'Find submit button',
        action: 'click',
        role: 'button',
        name: 'Submit Application',
        timeoutMs: 5000,
      });
      expect(roleStep.queryType).toBe('role_and_name');
      expect(roleStep.selectorString).toBe('role=button[name="Submit Application"]');

      const textStep = resolveSemanticQuery({
        id: 'step_2',
        description: 'Find text note',
        action: 'assert_text',
        text: 'All rights reserved',
        timeoutMs: 5000,
      });
      expect(textStep.queryType).toBe('text');
      expect(textStep.selectorString).toBe('text="All rights reserved"');
    });

    it('evaluates horizontal scroll overflow with subpixel threshold accuracy', () => {
      // Clean fits within 375px
      const cleanFit = evaluateHorizontalOverflow(375, 375);
      expect(cleanFit.hasOverflow).toBe(false);
      expect(cleanFit.excessPixels).toBe(0);

      // Subpixel 0.5px rounding error tolerated
      const subpixel = evaluateHorizontalOverflow(375.5, 375);
      expect(subpixel.hasOverflow).toBe(false);

      // Definite horizontal overflow
      const overflow = evaluateHorizontalOverflow(410, 375);
      expect(overflow.hasOverflow).toBe(true);
      expect(overflow.excessPixels).toBe(35);
    });

    it('verifies localStorage state persistence across reload', () => {
      const storage = {
        'shipshape_tasks_101': JSON.stringify([
          { id: 't1', title: 'Verify E2E Benchmark Pipeline', status: 'todo' },
        ]),
      };

      const match = verifyPersistenceIntegrity(storage, 'task', 'Verify E2E Benchmark Pipeline');
      expect(match.isPersisted).toBe(true);
      expect(match.matchedKey).toBe('shipshape_tasks_101');

      const miss = verifyPersistenceIntegrity(storage, 'task', 'NonExistentTask');
      expect(miss.isPersisted).toBe(false);
      expect(miss.error).toContain('NonExistentTask');
    });

    it('executes Scenario 1 assertions (SaaS Landing Page) and validates passing criteria', async () => {
      const mockLandingHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>DevOps Pulse</title></head>
          <body>
            <header role="banner">
              <nav><a href="#features">Features</a><a href="#pricing">Pricing</a></nav>
            </header>
            <main>
              <h1>DevOps Pulse — Real-Time Kubernetes Observability</h1>
              <button>Start Free Trial</button>
              <button>Book Demo</button>
              <section id="pricing">
                <div data-testid="pricing-tier-card"><h3>Starter</h3><p>$29/mo</p></div>
                <div data-testid="pricing-tier-card"><h3>Team</h3><p>$79/mo</p></div>
                <div data-testid="pricing-tier-card"><h3>Enterprise</h3><p>Custom</p></div>
              </section>
            </main>
          </body>
        </html>
      `;

      const report = await BenchmarkAssertionRunner.executeScenario1Assertions({
        html: mockLandingHtml,
        title: 'DevOps Pulse',
        desktopScrollWidth: 1280,
        mobileScrollWidth: 375,
        consoleErrors: [],
      });

      expect(report.scenarioId).toBe('bench_01_saas_landing');
      expect(report.passed).toBe(true);
      expect(report.totalSteps).toBe(7);
      expect(report.passedSteps).toBe(7);
      expect(report.failedSteps).toBe(0);
    });

    it('executes Scenario 1 assertions and catches mobile horizontal overflow defect', async () => {
      const mockLandingHtml = `
        <header><nav><a href="#pricing">Pricing</a></nav></header>
        <main>
          <h1>DevOps Pulse</h1>
          <button>Start Free Trial</button>
          <div data-testid="pricing-tier-card">Starter $29</div>
          <div data-testid="pricing-tier-card">Team $79</div>
          <div data-testid="pricing-tier-card">Enterprise</div>
        </main>
      `;

      const report = await BenchmarkAssertionRunner.executeScenario1Assertions({
        html: mockLandingHtml,
        title: 'DevOps Pulse',
        desktopScrollWidth: 1280,
        mobileScrollWidth: 420, // Overflows 375px mobile screen
        consoleErrors: [],
      });

      expect(report.passed).toBe(false);
      const overflowStep = report.stepResults.find((s) => s.stepId === 'saas_overflow_mobile');
      expect(overflowStep?.passed).toBe(false);
      expect(overflowStep?.error).toContain('Mobile scrollWidth (420px) exceeds 375px by 45px');
    });

    it('executes Scenario 4 assertions (Task Management) and verifies persistence after reload', async () => {
      const mockKanbanHtml = `
        <main>
          <h2>To Do</h2>
          <h2>In Progress</h2>
          <h2>Done</h2>
          <button>Add Task</button>
        </main>
      `;

      const taskTitle = 'Verify E2E Benchmark Pipeline';
      const beforeStorage = {
        'taskflow_app_tasks': JSON.stringify([{ id: '1', title: taskTitle, column: 'todo' }]),
      };
      const afterStorage = {
        'taskflow_app_tasks': JSON.stringify([{ id: '1', title: taskTitle, column: 'todo' }]),
      };

      const report = await BenchmarkAssertionRunner.executeScenario4Assertions({
        html: mockKanbanHtml,
        createdTaskTitle: taskTitle,
        storageBeforeReload: beforeStorage,
        storageAfterReload: afterStorage,
        columnsFound: ['To Do', 'In Progress', 'Done'],
        consoleErrors: [],
      });

      expect(report.scenarioId).toBe('bench_04_task_management');
      expect(report.passed).toBe(true);
      expect(report.totalSteps).toBe(7);
      expect(report.passedSteps).toBe(7);
    });

    it('executes Scenario 4 assertions and catches reload persistence failure', async () => {
      const mockKanbanHtml = `
        <main>
          <h2>To Do</h2>
          <h2>In Progress</h2>
          <h2>Done</h2>
          <button>Add Task</button>
        </main>
      `;

      const taskTitle = 'Verify E2E Benchmark Pipeline';
      const beforeStorage = {
        'taskflow_app_tasks': JSON.stringify([{ id: '1', title: taskTitle, column: 'todo' }]),
      };
      // Simulates bug where state is lost on reload
      const afterStorage = {};

      const report = await BenchmarkAssertionRunner.executeScenario4Assertions({
        html: mockKanbanHtml,
        createdTaskTitle: taskTitle,
        storageBeforeReload: beforeStorage,
        storageAfterReload: afterStorage,
        columnsFound: ['To Do', 'In Progress', 'Done'],
        consoleErrors: [],
      });

      expect(report.passed).toBe(false);
      const reloadStep = report.stepResults.find((s) => s.stepId === 'task_persisted_reload');
      expect(reloadStep?.passed).toBe(false);
      expect(reloadStep?.error).toContain('Reload persistence failure');
    });
  });

  describe('Deliverable 4: Metrics Contract & Accounting', () => {
    it('records measurement events and strictly separates simulated preview from real preview timings', async () => {
      const collector = new BenchmarkMetricsCollector('bench_01_saas_landing', 'run_metric_test_1');

      // 1. Initial UI feedback (T0)
      await new Promise((r) => setTimeout(r, 10));
      collector.record('initial_ui_feedback');

      // 2. Simulated preview ready (instant preview harness)
      await new Promise((r) => setTimeout(r, 15));
      collector.record('simulated_preview_ready');

      // 3. AI code generation complete
      await new Promise((r) => setTimeout(r, 10));
      collector.record('ai_generation_completed');

      // 4. Sandbox compilation complete (T2)
      await new Promise((r) => setTimeout(r, 20));
      collector.record('compilation_completed');

      // 5. Genuine browser preview ready (T1)
      await new Promise((r) => setTimeout(r, 15));
      collector.record('browser_preview_ready');

      // 6. Functional verification complete (T3)
      await new Promise((r) => setTimeout(r, 15));
      collector.record('functional_verification_completed');

      const metrics = collector.finalize('application_generation', true, 'completed', {
        tokens: {
          promptTokens: 1000,
          candidatesTokens: 8000,
          thoughtTokens: 0,
          totalTokens: 9000,
        },
        compute: {
          sandboxProvisionMs: 1500,
          dependencyInstallMs: 4000,
          compileBuildMs: 3500,
        },
      });

      // Verify all latency metrics are captured
      expect(metrics.t0_initialFeedbackMs).toBeGreaterThan(0);
      expect(metrics.t1_simulatedPreviewMs).toBeGreaterThan(0);
      expect(metrics.t1_realBrowserPreviewMs).toBeGreaterThan(0);
      expect(metrics.t2_compilationMs).toBeGreaterThan(0);
      expect(metrics.t3_functionalVerificationMs).toBeGreaterThan(0);

      // Verify that simulated preview and real browser preview are independent
      expect(metrics.t1_simulatedPreviewMs).not.toEqual(metrics.t1_realBrowserPreviewMs);
      expect(metrics.t1_simulatedPreviewMs!).toBeLessThan(metrics.t1_realBrowserPreviewMs!);

      // Verify cost calculations
      // AI: (1000/1M * 0.10) + (8000/1M * 0.40) = 0.00010 + 0.00320 = $0.0033
      expect(metrics.cost.aiInferenceUsd).toBeCloseTo(0.0033, 4);

      // Compute: (9000ms / 1000s) * 0.00002 = 9 * 0.00002 = $0.00018
      expect(metrics.cost.computeUsd).toBeCloseTo(0.00018, 4);

      // Total USD
      expect(metrics.cost.totalUsd).toBeCloseTo(0.00348, 4);

      // Verify inferred verification taxonomy status
      expect(metrics.verificationStatus).toBe('sandbox_browser_verified');
    });

    it('enforces the 6-state verification taxonomy and calculates cost per success accurately', () => {
      const c1 = new BenchmarkMetricsCollector('bench_01_saas_landing', 'run_1');
      const rep1 = c1.finalize('application_generation', true, 'completed', {
        verificationStatus: 'sandbox_browser_verified',
        tokens: { promptTokens: 1000, candidatesTokens: 8000 },
      });

      const c2 = new BenchmarkMetricsCollector('bench_02_dev_portfolio', 'run_2');
      const rep2 = c2.finalize('application_generation', false, 'failed', {
        verificationStatus: 'container_build_passed',
        tokens: { promptTokens: 1200, candidatesTokens: 4000 },
        failureReason: 'Turbopack build error in Page component',
      });

      const c3 = new BenchmarkMetricsCollector('bench_02_dev_portfolio', 'run_3');
      const rep3 = c3.finalize('application_generation', true, 'completed', {
        verificationStatus: 'repair_converged',
        tokens: { promptTokens: 800, candidatesTokens: 3000 },
      });

      expect(rep1.verificationStatus).toBe('sandbox_browser_verified');
      expect(rep2.verificationStatus).toBe('container_build_passed');
      expect(rep3.verificationStatus).toBe('repair_converged');

      // Test economic calculation across all attempts (including the failed attempt)
      const economics = BenchmarkMetricsCollector.calculateCostPerSuccess([rep1, rep2, rep3]);
      expect(economics.totalCostUsd).toBeGreaterThan(0);
      expect(economics.successfulCount).toBe(1); // Only rep1 is verified
      // Cost per success = Total cost of all 3 attempts / 1 success
      expect(economics.costPerSuccessUsd).toBe(economics.totalCostUsd);
    });
  });
});
