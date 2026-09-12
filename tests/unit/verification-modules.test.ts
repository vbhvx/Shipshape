import { describe, it, expect } from 'vitest';
import { ConsoleErrorCollector } from '@/modules/verification/console-error-collector';
import { BenchmarkReporter } from '@/modules/verification/benchmark-reporter';
import { evaluateHorizontalOverflow } from '@/../tests/benchmark/assertions';

describe('Verification Modules Unit Tests (Phase 4 Step 3)', () => {
  it('correctly calculates horizontal overflow thresholds', () => {
    // Exact fit: no overflow
    const exact = evaluateHorizontalOverflow(1280, 1280);
    expect(exact.hasOverflow).toBe(false);
    expect(exact.excessPixels).toBe(0);

    // Subpixel tolerance (<= 1px) does not flag overflow
    const subpixel = evaluateHorizontalOverflow(1280.8, 1280);
    expect(subpixel.hasOverflow).toBe(false);

    // Definite overflow (> 1px)
    const overflow = evaluateHorizontalOverflow(1340, 1280);
    expect(overflow.hasOverflow).toBe(true);
    expect(overflow.excessPixels).toBe(60);
  });

  it('manages console error collection lifecycle', () => {
    const collector = new ConsoleErrorCollector();
    expect(collector.hasErrors()).toBe(false);
    expect(collector.getErrors()).toEqual([]);

    // Manually push simulated record to verify retrieval and formatting
    (collector as any).records.push({
      type: 'console_error',
      text: 'TypeError: Cannot read properties of undefined',
      timestamp: new Date().toISOString(),
    });

    expect(collector.hasErrors()).toBe(true);
    expect(collector.getErrors()).toHaveLength(1);
    expect(collector.getErrors()[0]).toContain('TypeError');

    collector.clear();
    expect(collector.hasErrors()).toBe(false);
    expect(collector.getErrors()).toEqual([]);
  });

  it('generates structured Markdown and JSON reports with separated metrics', () => {
    const payload = {
      timestamp: '2026-10-30T12:00:00Z',
      environment: {
        nodeVersion: 'v24.0.0',
        playwrightInstalled: true,
        dockerAvailable: false,
      },
      metrics: {
        contractEvaluatedCount: 10,
        realBrowserTestedCount: 2,
        passedCount: 2,
        failedCount: 0,
        overallPassRate: 1.0,
      },
      results: [
        {
          scenarioId: 'bench_01_saas_landing',
          mode: 'headless_chromium' as const,
          passed: true,
          durationMs: 450,
          stepSummary: '7/7 steps passed',
        },
        {
          scenarioId: 'bench_04_task_management',
          mode: 'headless_chromium' as const,
          passed: true,
          durationMs: 620,
          stepSummary: '7/7 steps passed',
        },
      ],
    };

    const json = BenchmarkReporter.generateJsonReport(payload);
    expect(json).toContain('"contractEvaluatedCount": 10');
    expect(json).toContain('"realBrowserTestedCount": 2');

    const md = BenchmarkReporter.generateMarkdownReport(payload);
    expect(md).toContain('# Shipshape — Empirical Benchmark Evaluation Report');
    expect(md).toContain('| Contract Specifications Validated | 10 |');
    expect(md).toContain('| Live Browser Applications Verified | 2 |');
    expect(md).toContain('bench_01_saas_landing');
    expect(md).toContain('headless_chromium');
  });
});

