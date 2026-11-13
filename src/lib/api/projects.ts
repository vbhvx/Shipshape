import type {
  BuildCheckResult,
  BuildLog,
  GeneratedFile,
  GenerationEvent,
  GenerationRun,
  Project,
  ProjectSpecification,
  ProjectVersion,
  SandboxSession,
  VersionDiff,
} from '@/types';
import { apiRequest, downloadFile } from './client';

/**
 * Typed calls for every `/api/v1` endpoint the UI uses. Response shapes mirror
 * the route handlers in `src/app/api/v1`; keep the two in step.
 */

const enc = encodeURIComponent;
const project = (id: string) => `/api/v1/projects/${enc(id)}`;
const run = (id: string) => `/api/v1/generation-runs/${enc(id)}`;

export interface ProjectDetail {
  project: Project;
  specification: ProjectSpecification | null;
  latestVersion: ProjectVersion | null;
  versionsCount: number;
  sandbox: SandboxSession | null;
  activeRun: GenerationRun | null;
}

export interface RunStart {
  runId: string;
  run: GenerationRun | null;
  status: string;
  message: string;
}

export interface RunDetail {
  run: GenerationRun;
  events: GenerationEvent[];
  buildLogs: BuildLog[];
  buildResults: BuildCheckResult[];
}

export const projectsApi = {
  list: async () => (await apiRequest<{ projects: Project[] }>('/api/v1/projects')).projects,

  create: async (input: { name: string; description: string }) =>
    (await apiRequest<{ project: Project }>('/api/v1/projects', { method: 'POST', json: input })).project,

  get: (id: string) => apiRequest<ProjectDetail>(project(id)),

  rename: async (id: string, name: string) =>
    (await apiRequest<{ project: Project }>(project(id), { method: 'PATCH', json: { name } })).project,

  archive: async (id: string) => {
    await apiRequest(project(id), { method: 'DELETE' });
  },

  duplicate: async (id: string) =>
    (await apiRequest<{ project: Project }>(`${project(id)}/duplicate`, { method: 'POST' })).project,

  versions: async (id: string) =>
    (await apiRequest<{ versions: ProjectVersion[] }>(`${project(id)}/versions`)).versions,

  files: async (id: string, versionId: string) =>
    (await apiRequest<{ files: GeneratedFile[] }>(`${project(id)}/files?versionId=${enc(versionId)}`)).files,

  diff: async (id: string, versionId: string) =>
    (await apiRequest<{ diff: VersionDiff }>(`${project(id)}/versions/${enc(versionId)}/diff`)).diff,

  generate: (id: string, prompt: string) =>
    apiRequest<RunStart>(`${project(id)}/generate`, { method: 'POST', json: { prompt } }),

  modify: (id: string, instruction: string, baseVersionId?: string) =>
    apiRequest<RunStart>(`${project(id)}/modify`, { method: 'POST', json: { instruction, baseVersionId } }),

  restore: async (id: string, versionId: string) =>
    (await apiRequest<{ restoredVersion: ProjectVersion }>(`${project(id)}/restore`, {
      method: 'POST',
      json: { versionId },
    })).restoredVersion,

  startRuntime: async (id: string) =>
    (await apiRequest<{ session: SandboxSession }>(`${project(id)}/runtime/start`, { method: 'POST' })).session,

  /** Downloads the zip; the server names it, `fallbackName` is used only if it does not. */
  exportZip: (id: string, fallbackName: string, versionId?: string) =>
    downloadFile(`${project(id)}/export${versionId ? `?versionId=${enc(versionId)}` : ''}`, fallbackName),
};

export const runsApi = {
  get: (id: string) => apiRequest<RunDetail>(run(id)),
  cancel: async (id: string) => {
    await apiRequest(`${run(id)}/cancel`, { method: 'POST' });
  },
  eventsUrl: (id: string) => `${run(id)}/events`,
};
