'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Project } from '@/types';
import { projectsApi } from '@/lib/api/projects';
import { ApiClientError, describeError } from '@/lib/api/client';
import { exportFileName } from '@/lib/format';

/** `signed-out` is not a failure: the visitor needs to sign in before there is a list to show. */
export type LoadStatus = 'loading' | 'ready' | 'signed-out' | 'error';

/**
 * The signed-in user's projects, as the projects and applications pages show
 * them. The server is the source of truth: mutations call the API first and
 * only then update the local list, so a failed request never leaves the UI
 * showing a change that did not happen.
 */
export function useProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setProjects(await projectsApi.list());
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiClientError && err.isUnauthenticated) {
        setProjects([]);
        setStatus('signed-out');
        return;
      }
      setError(describeError(err, 'Could not load your projects.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Archives a project; throws on failure so the caller can show the message. */
  const remove = useCallback(async (id: string) => {
    await projectsApi.archive(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /** Downloads a project's latest version as a zip; throws on failure. */
  const exportZip = useCallback(async (project: Pick<Project, 'id' | 'name'>) => {
    setExportingId(project.id);
    try {
      return await projectsApi.exportZip(project.id, exportFileName(project.name));
    } finally {
      setExportingId(null);
    }
  }, []);

  return { projects, setProjects, status, error, reload, remove, exportZip, exportingId };
}
