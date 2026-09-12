import { describe, it, expect } from 'vitest';
import { BoundedRepairLoop } from '../../src/modules/repair/repair-loop';
import { GeneratedFile, BuildCheckResult } from '../../src/types';

describe('Bounded Agent Repair Loop', () => {
  it('bounds retry attempts and successfully repairs broken JSON syntax', async () => {
    const brokenFiles: GeneratedFile[] = [
      {
        path: 'package.json',
        content: '{\n  "name": "broken-app",,\n}', // Invalid JSON syntax (double comma)
        responsibility: 'Package config',
        fileType: 'config',
        sizeBytes: 30,
        mimeType: 'application/json',
      },
      {
        path: 'tsconfig.json',
        content: '{}',
        responsibility: 'TS config',
        fileType: 'config',
        sizeBytes: 2,
        mimeType: 'application/json',
      },
      {
        path: 'src/app/layout.tsx',
        content: 'export default function Layout() { return null; }',
        responsibility: 'Layout',
        fileType: 'layout',
        sizeBytes: 50,
        mimeType: 'text/typescript',
      },
      {
        path: 'src/app/page.tsx',
        content: 'export default function Page() { return null; }',
        responsibility: 'Page',
        fileType: 'page',
        sizeBytes: 50,
        mimeType: 'text/typescript',
      },
    ];

    const failedChecks: BuildCheckResult[] = [
      {
        id: 'chk_1',
        generationRunId: 'run_test_repair',
        checkType: 'typecheck',
        status: 'failed',
        exitCode: 1,
        durationMs: 50,
        errors: [{ file: 'package.json', message: 'JSON syntax error' }],
        createdAt: new Date().toISOString(),
      },
    ];

    const result = await BoundedRepairLoop.attemptRepair('proj_test_repair', 'run_test_repair', brokenFiles, failedChecks);

    expect(result.attemptsUsed).toBeLessThanOrEqual(BoundedRepairLoop.MAX_ATTEMPTS);
    expect(result.success).toBe(true);
    expect(result.summary).toContain('Successfully diagnosed and repaired');

    const fixedPackage = result.fixedFiles.find((f) => f.path === 'package.json');
    expect(() => JSON.parse(fixedPackage!.content)).not.toThrow();
  });
});
