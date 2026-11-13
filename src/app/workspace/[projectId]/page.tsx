'use client';

import React, { useState, useEffect, use, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader';
import ChatIterationPanel from '@/components/workspace/ChatIterationPanel';
import PlanSpecPanel from '@/components/workspace/PlanSpecPanel';
import VersionDiffPanel from '@/components/workspace/VersionDiffPanel';
import LivePreviewPanel from '@/components/workspace/LivePreviewPanel';
import CodeInspectorPanel from '@/components/workspace/CodeInspectorPanel';
import DiagnosticsPanel from '@/components/workspace/DiagnosticsPanel';
import TabButton from '@/components/workspace/TabButton';
import ErrorState from '@/components/ui/ErrorState';
import { projectsApi, runsApi, type RunDetail } from '@/lib/api/projects';
import { describeError } from '@/lib/api/client';
import { isRunStale, isTerminalStatus, RUN_STALE_AFTER_MS } from '@/lib/runs/status';
import { exportFileName } from '@/lib/format';
import {
  Project,
  ProjectSpecification,
  ProjectVersion,
  GeneratedFile,
  GenerationRun,
  GenerationEvent,
  BuildLog,
  BuildCheckResult,
} from '@/types';
import { MessageSquare, FileText, History, Eye, Code2, Terminal, Loader2 } from 'lucide-react';

/** A run still worth streaming: not finished and not abandoned by a dead instance. */
const isLiveRun = (run: GenerationRun) => !isTerminalStatus(run.status) && !isRunStale(run);

/**
 * Stands in for a run while its generate/modify request is open. The server runs
 * the whole job inside that request, so there is no real run id to poll or
 * stream until it returns; the request itself is the bound.
 */
const PROVISIONAL_RUN_PREFIX = 'pending_';
const isProvisional = (runId?: string) => !runId || runId.startsWith(PROVISIONAL_RUN_PREFIX);

function WorkspaceContent({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramRunId = searchParams.get('runId');
  const activeEventSourceRef = useRef<EventSource | null>(null);
  // The run whose end has already been handled: the SSE status and done frames, the poll
  // and the request's own response can each report the same ending.
  const finishedRunIdRef = useRef<string | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>('');
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [specification, setSpecification] = useState<ProjectSpecification | null>(null);

  // Active generation/modification run state
  const [activeRun, setActiveRun] = useState<GenerationRun | null>(null);
  const [events, setEvents] = useState<GenerationEvent[]>([]);
  const [logs, setLogs] = useState<BuildLog[]>([]);
  const [buildResults, setBuildResults] = useState<BuildCheckResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [previewRefreshTrigger, setPreviewRefreshTrigger] = useState(0);

  // Tabs
  const [leftTab, setLeftTab] = useState<'chat' | 'plan' | 'versions'>('chat');
  const [rightTab, setRightTab] = useState<'preview' | 'code' | 'logs'>('preview');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /** Applies a run's diagnostics; empty lists from the server never wipe what is shown. */
  const applyRunDetail = (detail: RunDetail, { includeRun = true } = {}) => {
    if (includeRun && detail.run) setActiveRun(detail.run);
    if (detail.events?.length) setEvents(detail.events);
    if (detail.buildResults) setBuildResults(detail.buildResults);
    if (detail.buildLogs) setLogs(detail.buildLogs);
  };

  const showVersionFiles = async (versionId: string) => {
    const versionFiles = await projectsApi.files(projectId, versionId);
    setFiles(versionFiles);
    setSelectedFile(versionFiles[0] || null);
  };

  /** Re-reads versions, files, project state and the tracked run's diagnostics after a run ends. */
  const reloadVersionsAndFiles = async () => {
    try {
      const projectVersions = await projectsApi.versions(projectId);
      if (projectVersions.length > 0) {
        setVersions(projectVersions);
        setActiveVersionId(projectVersions[0].id);
        await showVersionFiles(projectVersions[0].id);
      }

      const detail = await projectsApi.get(projectId);
      setProject(detail.project);
      if (detail.specification) setSpecification(detail.specification);
      if (detail.activeRun) setActiveRun(detail.activeRun);

      const runToFetch = activeRun?.id || paramRunId;
      if (runToFetch) {
        applyRunDetail(await runsApi.get(runToFetch), { includeRun: false });
      }
    } catch (err) {
      // A failed refresh keeps the last good state on screen; the next run end retries.
      console.warn('Workspace refresh failed:', describeError(err));
    }
  };

  /** Handles a run's end once, whichever channel (stream, poll, response) reports it first. */
  const finishRun = (runId: string) => {
    if (finishedRunIdRef.current === runId) return;
    finishedRunIdRef.current = runId;
    activeEventSourceRef.current?.close();
    activeEventSourceRef.current = null;
    setIsProcessing(false);
    void reloadVersionsAndFiles();
    setPreviewRefreshTrigger((k) => k + 1);
  };

  // Stream progress for a running generation (SSE), with polling below as the fallback.
  const connectSSE = (runId: string) => {
    activeEventSourceRef.current?.close();
    finishedRunIdRef.current = null;

    setIsProcessing(true);
    const eventSource = new EventSource(runsApi.eventsUrl(runId));
    activeEventSourceRef.current = eventSource;

    eventSource.addEventListener('message', (e) => {
      try {
        const evt = JSON.parse(e.data) as GenerationEvent;
        setEvents((prev) => (prev.some((existing) => existing.id === evt.id) ? prev : [...prev, evt]));
      } catch {
        // A malformed frame is skipped; the polling fallback re-reads the full event list.
      }
    });

    eventSource.addEventListener('status', (e) => {
      try {
        const { status } = JSON.parse(e.data) as { status: GenerationRun['status'] };
        setActiveRun((prev) => (prev ? { ...prev, status } : null));
        if (isTerminalStatus(status)) finishRun(runId);
      } catch {
        // As above: polling keeps the status right if a frame cannot be read.
      }
    });

    eventSource.addEventListener('done', () => {
      finishRun(runId);
    });

    eventSource.addEventListener('error', async () => {
      eventSource.close();
      activeEventSourceRef.current = null;
      try {
        const detail = await runsApi.get(runId);
        setActiveRun(detail.run);
        if (isTerminalStatus(detail.run.status)) {
          finishRun(runId);
          return;
        }
      } catch {
        // The stream and the read both failed; release the lock below so the user can retry.
      }
      setIsProcessing(false);
    });
  };

  // Handle iterative modification prompt (or initial generation if no base version yet)
  const handleSendMessage = async (text: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const hasBaseVersion = !!activeVersionId && versions.length > 0;

      // Provisional run so the polling fallback does not re-read the previous, finished run.
      setActiveRun({
        id: PROVISIONAL_RUN_PREFIX + Date.now(),
        projectId,
        runType: hasBaseVersion ? 'modification' : 'generation',
        status: 'generating',
        modelProvider: 'deterministic',
        modelIdentifier: 'engine',
        attemptCount: 1,
        prompt: text,
        startedAt: new Date().toISOString(),
      });

      const started = hasBaseVersion
        ? await projectsApi.modify(projectId, text, activeVersionId)
        : await projectsApi.generate(projectId, text);

      if (started.run) setActiveRun(started.run);

      if (started.runId) {
        try {
          applyRunDetail(await runsApi.get(started.runId), { includeRun: false });
        } catch (err) {
          console.warn('Run details could not be loaded:', describeError(err));
        }
      }

      if (isTerminalStatus(started.status || started.run?.status || '')) {
        finishRun(started.runId);
      } else {
        connectSSE(started.runId);
      }
    } catch (err) {
      alert(`Execution error: ${describeError(err)}`);
      setIsProcessing(false);
      await reloadVersionsAndFiles();
    }
  };

  // Watchdog for streamed runs: release the UI lock if no terminal status arrives within the
  // server's stale threshold. A provisional run is bounded by its own request instead.
  useEffect(() => {
    if (!isProcessing || isProvisional(activeRun?.id)) return;
    const timeout = setTimeout(() => {
      setIsProcessing(false);
      void reloadVersionsAndFiles();
    }, RUN_STALE_AFTER_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, activeRun?.id]);

  // Initial load
  useEffect(() => {
    let ignore = false;
    async function loadWorkspace() {
      try {
        setLoading(true);
        const detail = await projectsApi.get(projectId);
        if (ignore) return;
        setProject(detail.project);
        setSpecification(detail.specification);

        const projectVersions = await projectsApi.versions(projectId);
        if (ignore) return;
        setVersions(projectVersions);
        const activeV = detail.project.activeVersionId || projectVersions[0]?.id;
        setActiveVersionId(activeV ?? '');
        if (activeV) await showVersionFiles(activeV);

        // Resume a run named in the URL, or the project's latest one.
        const runIdToTrack = paramRunId || detail.activeRun?.id;
        if (runIdToTrack) {
          try {
            const run = await runsApi.get(runIdToTrack);
            applyRunDetail(run);
            if (isLiveRun(run.run)) {
              setIsProcessing(true);
              connectSSE(runIdToTrack);
            }
          } catch (err) {
            console.warn('Run details could not be loaded:', describeError(err));
          }
        }

        // Autostart the first generation when arriving from the prompt page with nothing built yet.
        const shouldAutostart = searchParams.get('autostart') === 'true';
        if (shouldAutostart && !runIdToTrack && projectVersions.length === 0 && detail.project.description) {
          void handleSendMessage(detail.project.description);
        }
      } catch (err) {
        if (!ignore) setError(describeError(err, 'Unable to load project workspace.'));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadWorkspace();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, paramRunId]);

  // Close the event stream on unmount
  useEffect(() => {
    return () => {
      activeEventSourceRef.current?.close();
      activeEventSourceRef.current = null;
    };
  }, []);

  // Polling fallback while a real run streams (covers dropped streams and proxies that buffer SSE)
  useEffect(() => {
    if (!isProcessing || !activeRun || isProvisional(activeRun.id)) return;
    const runId = activeRun.id;

    const interval = setInterval(async () => {
      try {
        const detail = await runsApi.get(runId);
        applyRunDetail(detail);
        if (isTerminalStatus(detail.run.status)) finishRun(runId);
      } catch {
        // A transient failure; the next tick retries and the stream may still report the end.
      }
    }, 1500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, activeRun?.id]);

  const handleSelectVersion = async (versionId: string) => {
    setActiveVersionId(versionId);
    try {
      await showVersionFiles(versionId);
    } catch (err) {
      alert(`Could not open that version: ${describeError(err)}`);
    }
  };

  const handleRestoreVersion = async (targetVersionId: string) => {
    if (!confirm('Restore this snapshot to a new version?')) return;
    try {
      const restored = await projectsApi.restore(projectId, targetVersionId);
      await reloadVersionsAndFiles();
      alert(`Restored to new Version ${restored.versionNumber}`);
    } catch (err) {
      alert(`Restore failed: ${describeError(err)}`);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await projectsApi.exportZip(projectId, exportFileName(project?.name ?? 'project'), activeVersionId || undefined);
    } catch (err) {
      alert(`Export failed: ${describeError(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestartSandbox = async () => {
    try {
      setIsRestarting(true);
      await projectsApi.startRuntime(projectId);
      alert('Sandbox runtime successfully restarted.');
    } catch (err) {
      alert(`Restart failed: ${describeError(err)}`);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleCancelRun = async () => {
    if (!activeRun) return;
    try {
      await runsApi.cancel(activeRun.id);
    } catch (err) {
      alert(`Cancel failed: ${describeError(err)}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center space-y-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
        <div className="text-xs font-mono">Loading Shipshape Workspace...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <ErrorState
          title="Project Not Found"
          message={error || 'Unable to load project workspace.'}
          onRetry={() => router.push('/projects')}
          retryLabel="Return to Projects"
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden font-sans">
      {/* Workspace Top Header */}
      <WorkspaceHeader
        project={project}
        versions={versions}
        activeVersionId={activeVersionId}
        onSelectVersion={handleSelectVersion}
        onExport={handleExport}
        onRestartSandbox={handleRestartSandbox}
        isExporting={isExporting}
        isRestarting={isRestarting}
      />

      {/* Main Workspace Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Chat / Plan / Versions */}
        <div className="w-full md:w-[460px] lg:w-[500px] border-r border-zinc-800 flex flex-col shrink-0 bg-zinc-950">
          <div className="h-10 border-b border-zinc-800 bg-zinc-900/60 px-2 flex items-center gap-1 text-xs select-none">
            <TabButton active={leftTab === 'chat'} onClick={() => setLeftTab('chat')}>
              <MessageSquare className="w-3.5 h-3.5 text-zinc-300" />
              <span>Agent & Chat</span>
              {isProcessing && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
            </TabButton>
            <TabButton active={leftTab === 'plan'} onClick={() => setLeftTab('plan')}>
              <FileText className="w-3.5 h-3.5 text-zinc-300" />
              <span>Spec & Plan</span>
            </TabButton>
            <TabButton active={leftTab === 'versions'} onClick={() => setLeftTab('versions')}>
              <History className="w-3.5 h-3.5 text-zinc-300" />
              <span>History & Diffs</span>
              <span className="text-[10px] font-mono text-zinc-500">({versions.length})</span>
            </TabButton>
          </div>

          <div className="flex-1 overflow-hidden">
            {leftTab === 'chat' && (
              <ChatIterationPanel
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
                activeRun={activeRun}
                events={events}
                prompt={project?.description || specification?.description}
                projectName={project?.name}
                onCancelRun={handleCancelRun}
              />
            )}
            {leftTab === 'plan' && <PlanSpecPanel specification={specification} />}
            {leftTab === 'versions' && (
              <VersionDiffPanel
                projectId={projectId}
                versions={versions}
                activeVersionId={activeVersionId}
                onRestoreVersion={handleRestoreVersion}
                isRestoring={false}
              />
            )}
          </div>
        </div>

        {/* Right Panel: Preview / Code / Diagnostics */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
          <div className="h-10 border-b border-zinc-800 bg-zinc-900/60 px-4 flex items-center justify-between text-xs select-none">
            <div className="flex items-center gap-1">
              <TabButton active={rightTab === 'preview'} onClick={() => setRightTab('preview')}>
                <Eye className="w-3.5 h-3.5 text-zinc-300" />
                <span>Live Preview</span>
              </TabButton>
              <TabButton active={rightTab === 'code'} onClick={() => setRightTab('code')}>
                <Code2 className="w-3.5 h-3.5 text-zinc-300" />
                <span>Source Code</span>
                <span className="text-[10px] font-mono text-zinc-500">({files.length})</span>
              </TabButton>
              <TabButton active={rightTab === 'logs'} onClick={() => setRightTab('logs')}>
                <Terminal className="w-3.5 h-3.5 text-zinc-300" />
                <span>Diagnostics & Logs</span>
              </TabButton>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightTab === 'preview' && (
              <LivePreviewPanel
                projectId={projectId}
                isRunning={project?.status === 'running' || !!activeVersionId}
                activeVersionId={activeVersionId}
                refreshTrigger={previewRefreshTrigger}
              />
            )}
            {rightTab === 'code' && (
              <CodeInspectorPanel
                files={files}
                selectedFile={selectedFile}
                onSelectFile={(f) => setSelectedFile(f)}
              />
            )}
            {rightTab === 'logs' && (
              <DiagnosticsPanel
                logs={logs}
                buildResults={buildResults}
                onTriggerRepair={() => handleSendMessage('Diagnose build failure and fix errors')}
                isRepairing={isProcessing}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage(props: { params: Promise<{ projectId: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center space-y-3 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
          <div className="text-xs font-mono">Loading Shipshape Workspace...</div>
        </div>
      }
    >
      <WorkspaceContent params={props.params} />
    </Suspense>
  );
}
