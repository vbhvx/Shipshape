import type { ModelFixture } from './saas-landing-fixture';
import { DEVOPS_PULSE_FIXTURE } from './saas-landing-fixture';

/**
 * Fixture: Missing Essential Manifest Files
 * Deliberately omits src/app/page.tsx to test manifest validation and stub repair.
 */
export const MISSING_MANIFEST_FIXTURE: ModelFixture = {
  id: 'fixture_missing_manifest',
  name: 'Missing Manifest Files Fixture',
  description: 'Simulates model synthesis omitting src/app/page.tsx',
  scenarioId: 'bench_09_error_recovery',
  version: '1.0.0',
  summary: 'Omitted core page component to evaluate manifest validation and stubbing',
  usageMetadata: { promptTokens: 400, candidatesTokens: 800, totalTokens: 1200, durationMs: 1200 },
  files: DEVOPS_PULSE_FIXTURE.files.filter((f) => f.path !== 'src/app/page.tsx'),
};

/**
 * Fixture: Invalid External Package Import
 * Introduces an illegal import from a non-existent package.
 */
export const INVALID_IMPORT_FIXTURE: ModelFixture = {
  id: 'fixture_invalid_import',
  name: 'Invalid Package Import Fixture',
  description: 'Simulates model importing non-existent module non-existent-ai-sdk',
  scenarioId: 'bench_09_error_recovery',
  version: '1.0.0',
  summary: 'Illegal package import triggering Turbopack module resolution error',
  usageMetadata: { promptTokens: 500, candidatesTokens: 1200, totalTokens: 1700, durationMs: 1500 },
  files: DEVOPS_PULSE_FIXTURE.files.map((f) => {
    if (f.path === 'src/app/page.tsx') {
      return {
        ...f,
        content: `import { UnresolvableEngine } from 'non-existent-ai-sdk';\n` + f.content,
      };
    }
    return f;
  }),
};

/**
 * Fixture: TypeScript Type Error
 * Introduces a strict TypeScript compilation violation.
 */
export const TS_TYPE_ERROR_FIXTURE: ModelFixture = {
  id: 'fixture_ts_type_error',
  name: 'TypeScript Compiler Error Fixture',
  description: 'Simulates assigning incompatible types inside a component',
  scenarioId: 'bench_09_error_recovery',
  version: '1.0.0',
  summary: 'Type mismatch in component props caught by tsc / Next.js build',
  usageMetadata: { promptTokens: 520, candidatesTokens: 1400, totalTokens: 1920, durationMs: 1600 },
  files: DEVOPS_PULSE_FIXTURE.files.map((f) => {
    if (f.path === 'src/components/HeaderNav.tsx') {
      return {
        ...f,
        content: f.content.replace(
          `export function HeaderNav() {`,
          `export function HeaderNav() {\n  const typeError: number = "cannot-assign-string-to-number";\n`
        ),
      };
    }
    return f;
  }),
};

/**
 * Fixture: Repairable Syntax Defect
 * Contains a malformed JSX button tag that BoundedRepairLoop can diagnose and repair.
 */
export const REPAIRABLE_SYNTAX_FIXTURE: ModelFixture = {
  id: 'fixture_repairable_syntax',
  name: 'Repairable JSX Syntax Defect Fixture',
  description: 'Synthesized component with malformed unclosed JSX attribute',
  scenarioId: 'bench_09_error_recovery',
  version: '1.0.0',
  summary: 'Syntax error in component that BoundedRepairLoop converges on',
  usageMetadata: { promptTokens: 580, candidatesTokens: 1800, totalTokens: 2380, durationMs: 1800 },
  files: DEVOPS_PULSE_FIXTURE.files.map((f) => {
    if (f.path === 'src/components/HeaderNav.tsx') {
      return {
        ...f,
        content: f.content.replace(
          `</a>\n              </div>`,
          `</broken_unclosed_tag>\n              </div>`
        ),
      };
    }
    return f;
  }),
};

/**
 * Fixture: Unrepairable Fatal Defect
 * Catastrophically invalid file that fails all 3 repair loop attempts.
 */
export const UNREPAIRABLE_FATAL_FIXTURE: ModelFixture = {
  id: 'fixture_unrepairable_fatal',
  name: 'Unrepairable Fatal Defect Fixture',
  description: 'Corrupted binary garbage in core manifest that cannot be repaired',
  scenarioId: 'bench_09_error_recovery',
  version: '1.0.0',
  summary: 'Irrecoverable build error verifying bounded repair limit enforcement',
  usageMetadata: { promptTokens: 300, candidatesTokens: 400, totalTokens: 700, durationMs: 900 },
  files: DEVOPS_PULSE_FIXTURE.files.map((f) => {
    if (f.path === 'package.json') {
      return {
        ...f,
        content: `<<<FATAL_UNPARSEABLE_CORRUPTION_BINARY_NULL_BYTE>>>`,
      };
    }
    return f;
  }),
};

