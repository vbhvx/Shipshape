import type { GenerationRun, GenerationRunStatus, ProjectStatus } from '@/types';

/**
 * The run and project state machines, in one place.
 *
 * Shared by the server (storage adapters enforce the transitions, the reaper and
 * conflict checks read the terminal set) and the workspace UI (when to stream,
 * poll or stop). Pure, with no server dependencies.
 */

// ---------------------------------------------------------------------------
// Generation runs
// ---------------------------------------------------------------------------

export const TERMINAL_RUN_STATUSES: readonly GenerationRunStatus[] = ['completed', 'failed', 'cancelled'];
const TERMINAL_STATUSES: ReadonlySet<GenerationRunStatus> = new Set(TERMINAL_RUN_STATUSES);

/**
 * Forward steps a run may take. Every in-progress state may also end in
 * `failed` or `cancelled`, and in `completed` (publishing is gated separately by
 * the transaction in `publishVersionIfActive`): see `canTransitionRun`.
 *
 *   full generation: queued → planning → generating → validating → building → [repairing] → starting → preview_ready
 *   modification:    queued → generating → validating → building → [repairing], then publishes
 *   after a repair the run may validate again: repairing → validating
 */
const RUN_STEPS: Readonly<Record<GenerationRunStatus, readonly GenerationRunStatus[]>> = {
  queued: ['planning', 'generating'],
  planning: ['generating'],
  generating: ['validating'],
  validating: ['building'],
  building: ['repairing', 'starting'],
  repairing: ['validating', 'building', 'starting'],
  starting: ['preview_ready'],
  preview_ready: [],
  completed: [],
  failed: [],
  cancelled: [],
};

/**
 * An active run older than this is treated as abandoned (its instance died).
 * Deliberately longer than the generate/modify routes' 60s `maxDuration`, so a
 * live run is never reaped by a concurrent reader.
 */
export const RUN_STALE_AFTER_MS = 120_000;

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status as GenerationRunStatus);
}

export function isRunStale(run: Pick<GenerationRun, 'status' | 'startedAt'>, now = Date.now()): boolean {
  return !isTerminalStatus(run.status) && now - new Date(run.startedAt).getTime() > RUN_STALE_AFTER_MS;
}

/** Whether a run may move from `from` to `to`. Terminal states never change; rewriting the same state is allowed. */
export function canTransitionRun(from: GenerationRunStatus, to: GenerationRunStatus): boolean {
  if (isTerminalStatus(from)) return false;
  if (from === to || isTerminalStatus(to)) return true;
  return RUN_STEPS[from].includes(to);
}

/** Every state a run may be in immediately before `to` (for atomic conditional updates). */
export function runPredecessors(to: GenerationRunStatus): GenerationRunStatus[] {
  return (Object.keys(RUN_STEPS) as GenerationRunStatus[]).filter((from) => canTransitionRun(from, to));
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * Project lifecycle. Archiving is not a status: it is `archivedAt`, set by DELETE.
 *
 *   draft      a project with no version yet
 *   planning   a plan was written from a prompt
 *   generating a run is in progress
 *   running    the latest run published a version, or the preview runtime was started
 *   ready      a version exists and nothing is running (restored, stopped, or a run was cancelled)
 *   error      the latest run failed
 */
const PROJECT_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  draft: ['planning', 'generating'],
  // A project re-planned after a build keeps its versions, so it can still be restored or run.
  planning: ['planning', 'generating', 'draft', 'ready', 'running'],
  generating: ['running', 'ready', 'error', 'draft'],
  running: ['running', 'ready', 'planning', 'generating'],
  ready: ['ready', 'running', 'planning', 'generating'],
  error: ['error', 'ready', 'running', 'planning', 'generating'],
};

/**
 * Whether a project may move from `from` to `to`. A status outside the table
 * (a legacy row, e.g. `building` or `archived` from before these rules) may
 * move to any valid status, so old data can always be repaired.
 */
export function canTransitionProject(from: string, to: ProjectStatus): boolean {
  if (from === to) return true;
  const allowed = PROJECT_TRANSITIONS[from as ProjectStatus];
  return allowed === undefined || allowed.includes(to);
}

/**
 * What a project becomes when its latest run ends. A cancelled run leaves the
 * project as it was before: `ready` if it already has a version, else `draft`.
 */
export function projectStatusAfterRun(runStatus: GenerationRunStatus, hasActiveVersion: boolean): ProjectStatus {
  if (runStatus === 'completed') return 'running';
  if (runStatus === 'failed') return 'error';
  return hasActiveVersion ? 'ready' : 'draft';
}

/** Known statuses from which `to` is illegal (for an atomic `NOT IN` update that still lets legacy values move). */
export function illegalProjectPredecessors(to: ProjectStatus): ProjectStatus[] {
  return (Object.keys(PROJECT_TRANSITIONS) as ProjectStatus[]).filter((from) => !canTransitionProject(from, to));
}
