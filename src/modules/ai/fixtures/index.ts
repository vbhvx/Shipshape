export * from './saas-landing-fixture';
export * from './taskflow-kanban-fixture';
export * from './failure-fixtures';

import { DEVOPS_PULSE_FIXTURE } from './saas-landing-fixture';
import { TASKFLOW_KANBAN_FIXTURE } from './taskflow-kanban-fixture';
import {
  MISSING_MANIFEST_FIXTURE,
  INVALID_IMPORT_FIXTURE,
  TS_TYPE_ERROR_FIXTURE,
  REPAIRABLE_SYNTAX_FIXTURE,
  UNREPAIRABLE_FATAL_FIXTURE,
} from './failure-fixtures';
import type { ModelFixture } from './saas-landing-fixture';

export const ALL_FIXTURES: Record<string, ModelFixture> = {
  [DEVOPS_PULSE_FIXTURE.id]: DEVOPS_PULSE_FIXTURE,
  [TASKFLOW_KANBAN_FIXTURE.id]: TASKFLOW_KANBAN_FIXTURE,
  [MISSING_MANIFEST_FIXTURE.id]: MISSING_MANIFEST_FIXTURE,
  [INVALID_IMPORT_FIXTURE.id]: INVALID_IMPORT_FIXTURE,
  [TS_TYPE_ERROR_FIXTURE.id]: TS_TYPE_ERROR_FIXTURE,
  [REPAIRABLE_SYNTAX_FIXTURE.id]: REPAIRABLE_SYNTAX_FIXTURE,
  [UNREPAIRABLE_FATAL_FIXTURE.id]: UNREPAIRABLE_FATAL_FIXTURE,
};

export const SCENARIO_FIXTURE_MAP: Record<string, ModelFixture> = {
  bench_01_saas_landing: DEVOPS_PULSE_FIXTURE,
  bench_04_task_management: TASKFLOW_KANBAN_FIXTURE,
  bench_09_error_recovery: REPAIRABLE_SYNTAX_FIXTURE,
};

export function getFixtureById(id: string): ModelFixture | undefined {
  return ALL_FIXTURES[id];
}

export function getFixtureForScenario(scenarioId: string): ModelFixture | undefined {
  return SCENARIO_FIXTURE_MAP[scenarioId];
}
