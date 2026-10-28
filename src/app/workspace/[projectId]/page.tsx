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
import {
  Project,
  ProjectVersion,
  GeneratedFile,
  GenerationRun,
  GenerationEvent,
  BuildLog,
  BuildCheckResult,
} from '@/types';
import {
  MessageSquare,
  FileText,
  History,
  Eye,
  Code2,
  Terminal,
  Loader2,
  AlertCircle,
} from 'lucide-react';

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

  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>('');
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [specification, setSpecification] = useState<any>(null);

  // Active generation/modification run state
  const [activeRun, setActiveRun] = useState<GenerationRun | null>(null);
  const [events, setEvents] = useState<GenerationEvent[]>([]);
  const [logs, setLogs] = useState<BuildLog[]>([]);
  const [buildResults, setBuildResults] = useState<BuildCheckResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  // Tabs
  const [leftTab, setLeftTab] = useState<'chat' | 'plan' | 'versions'>('chat');
  const [rightTab, setRightTab] = useState<'preview' | 'code' | 'logs'>('preview');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reloadVersionsAndFiles = async () => {
    try {
      const versRes = await fetch(`/api/v1/projects/${projectId}/versions`);
      const versData = await versRes.json();
      if (versData.success && versData.versions.length > 0) {
        setVersions(versData.versions);
        const latest = versData.versions[0];
        if (latest) {
          setActiveVersionId(latest.id);
          const filesRes = await fetch(`/api/v1/projects/${projectId}/files?versionId=${latest.id}`);
          const filesData = await filesRes.json();
          if (filesData.success) {
            setFiles(filesData.files);
            setSelectedFile(filesData.files[0] || null);
          }
        }
      }

      // Also reload project to get updated status and activeVersionId
      const projRes = await fetch(`/api/v1/projects/${projectId}`);
      const projData = await projRes.json();
      if (projData.success) {
        setProject(projData.project);
        if (projData.specification) {
          setSpecification(projData.specification);
        }
        if (projData.activeRun) {
          setActiveRun(projData.activeRun);
        }
      }

      // Reload logs
      const runToFetch = activeRun?.id || paramRunId;
      if (runToFetch) {
        const runRes = await fetch(`/api/v1/generation-runs/${runToFetch}`);
        const runData = await runRes.json();
        if (runData.success) {
          setBuildResults(runData.buildResults || []);
          setLogs(runData.buildLogs || []);
        }
      }
    } catch (err) {
      console.error('Failed to reload workspace state:', err);
    }
  };

  // Connect SSE for active run
  const connectSSE = (runId: string) => {
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
    }

    setIsProcessing(true);
    const eventSource = new EventSource(`/api/v1/generation-runs/${runId}/events`);
    activeEventSourceRef.current = eventSource;

    eventSource.addEventListener('message', (e) => {
      try {
        const evt = JSON.parse(e.data);
        setEvents((prev) => {
          if (prev.some((existing) => existing.id === evt.id)) {
            return prev;
          }
          return [...prev, evt];
        });
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    eventSource.addEventListener('status', (e) => {
      try {
        const st = JSON.parse(e.data);
        setActiveRun((prev) => (prev ? { ...prev, status: st.status } : null));
        if (['completed', 'failed', 'cancelled'].includes(st.status)) {
          setIsProcessing(false);
          reloadVersionsAndFiles();
        }
      } catch {}
    });

    eventSource.addEventListener('done', () => {
      eventSource.close();
      activeEventSourceRef.current = null;
      setIsProcessing(false);
      reloadVersionsAndFiles();
    });

    eventSource.addEventListener('error', () => {
      eventSource.close();
      activeEventSourceRef.current = null;
    });
  };

  // Initial load
  useEffect(() => {
    let ignore = false;
    async function loadWorkspace() {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/projects/${projectId}`);
        const data = await res.json();
        if (!ignore && data.success) {
          setProject(data.project);
          setSpecification(data.specification);

          // Load versions
          const versRes = await fetch(`/api/v1/projects/${projectId}/versions`);
          const versData = await versRes.json();
          if (versData.success) {
            setVersions(versData.versions);
            const activeV = data.project.activeVersionId || versData.versions[0]?.id;
            setActiveVersionId(activeV);

            // Load files for active version
            if (activeV) {
              const filesRes = await fetch(`/api/v1/projects/${projectId}/files?versionId=${activeV}`);
              const filesData = await filesRes.json();
              if (filesData.success) {
                setFiles(filesData.files);
                setSelectedFile(filesData.files[0] || null);
              }
            }
          }

          // Check if there is an active run or runId from URL search param
          const runIdToTrack = paramRunId || data.activeRun?.id;
          if (runIdToTrack) {
            try {
              const runRes = await fetch(`/api/v1/generation-runs/${runIdToTrack}`);
              const runData = await runRes.json();
              if (runData.success && runData.run) {
                setActiveRun(runData.run);
                if (runData.events && runData.events.length > 0) {
                  setEvents(runData.events);
                }
                if (runData.buildResults) {
                  setBuildResults(runData.buildResults);
                }
                const isRunActive = [
                  'queued',
                  'planning',
                  'generating',
                  'validating',
                  'building',
                  'repairing',
                  'starting',
                ].includes(runData.run.status);

                if (isRunActive) {
                  setIsProcessing(true);
                  connectSSE(runIdToTrack);
                }
              }
            } catch (runErr) {
              console.warn('Failed to load initial run details:', runErr);
            }
          }
        } else if (!data.success) {
          setError(data.error || 'Failed to load project');
        }
      } catch (err: any) {
        if (!ignore) setError(err.message);
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

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (activeEventSourceRef.current) {
        activeEventSourceRef.current.close();
        activeEventSourceRef.current = null;
      }
    };
  }, []);

  // Resilient fallback polling loop while processing
  useEffect(() => {
    if (!isProcessing || !activeRun?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/generation-runs/${activeRun.id}`);
        const data = await res.json();
        if (data.success && data.run) {
          if (data.events && data.events.length > 0) {
            setEvents(data.events);
          }
          setActiveRun(data.run);
          if (data.buildResults) {
            setBuildResults(data.buildResults);
          }
          if (['completed', 'failed', 'cancelled'].includes(data.run.status)) {
            setIsProcessing(false);
            if (activeEventSourceRef.current) {
              activeEventSourceRef.current.close();
              activeEventSourceRef.current = null;
            }
            reloadVersionsAndFiles();
          }
        }
      } catch (err) {
        console.warn('Run status poll check error:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, activeRun?.id]);

  // Handle iterative modification prompt (or initial generation if no base version yet)
  const handleSendMessage = async (text: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const hasBaseVersion = !!activeVersionId && versions.length > 0;
      const endpoint = hasBaseVersion
        ? `/api/v1/projects/${projectId}/modify`
        : `/api/v1/projects/${projectId}/generate`;

      const payload = hasBaseVersion
        ? { instruction: text, baseVersionId: activeVersionId }
        : { prompt: text };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setActiveRun({
        id: data.runId,
        projectId,
        runType: hasBaseVersion ? 'modification' : 'generation',
        status: 'queued',
        modelProvider: 'deterministic',
        modelIdentifier: 'deterministic-engine-v1',
        attemptCount: 1,
        prompt: text,
        startedAt: new Date().toISOString(),
      });

      // Stream progress
      connectSSE(data.runId);
    } catch (err: any) {
      alert(`Execution error: ${err.message}`);
      setIsProcessing(false);
    }
  };

  // Handle version selection
  const handleSelectVersion = async (versionId: string) => {
    setActiveVersionId(versionId);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/files?versionId=${versionId}`);
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
        setSelectedFile(data.files[0] || null);
      }
    } catch (err) {
      console.error('Failed to switch version:', err);
    }
  };

  // Handle version restore
  const handleRestoreVersion = async (targetVersionId: string) => {
    if (!confirm('Restore this snapshot to a new version?')) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: targetVersionId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      await reloadVersionsAndFiles();
      alert(`Restored to new Version ${data.restoredVersion.versionNumber}`);
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    }
  };

  // Handle Export ZIP
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await fetch(`/api/v1/projects/${projectId}/export?versionId=${activeVersionId}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name.toLowerCase().replace(/\s+/g, '-') || 'project'}-export.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Restart Sandbox
  const handleRestartSandbox = async () => {
    try {
      setIsRestarting(true);
      await fetch(`/api/v1/projects/${projectId}/runtime/start`, { method: 'POST' });
      // Trigger preview refresh by changing right tab or state
      alert('Sandbox runtime successfully restarted.');
    } catch (err: any) {
      alert(`Restart failed: ${err.message}`);
    } finally {
      setIsRestarting(false);
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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-zinc-400" />
        <h2 className="text-lg font-bold text-zinc-100">Project Not Found</h2>
        <p className="text-xs text-zinc-400 max-w-sm">{error || 'Unable to load project workspace.'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition"
        >
          Return to Projects
        </button>
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
          {/* Left Panel Tabs */}
          <div className="h-10 border-b border-zinc-800 bg-zinc-900/60 px-2 flex items-center gap-1 text-xs select-none">
            <button
              onClick={() => setLeftTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                leftTab === 'chat'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-zinc-300" />
              <span>Agent & Chat</span>
              {isProcessing && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
            </button>
            <button
              onClick={() => setLeftTab('plan')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                leftTab === 'plan'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-zinc-300" />
              <span>Spec & Plan</span>
            </button>
            <button
              onClick={() => setLeftTab('versions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                leftTab === 'versions'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <History className="w-3.5 h-3.5 text-zinc-300" />
              <span>History & Diffs</span>
              <span className="text-[10px] font-mono text-zinc-500">({versions.length})</span>
            </button>
          </div>

          {/* Left Panel Body */}
          <div className="flex-1 overflow-hidden">
            {leftTab === 'chat' && (
              <ChatIterationPanel
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
                activeRun={activeRun}
                events={events}
                prompt={project?.description || specification?.description}
                projectName={project?.name}
                onCancelRun={async () => {
                  if (activeRun) {
                    await fetch(`/api/v1/generation-runs/${activeRun.id}/cancel`, { method: 'POST' });
                  }
                }}
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
          {/* Right Panel Tabs */}
          <div className="h-10 border-b border-zinc-800 bg-zinc-900/60 px-4 flex items-center justify-between text-xs select-none">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRightTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  rightTab === 'preview'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-zinc-300" />
                <span>Live Preview</span>
              </button>
              <button
                onClick={() => setRightTab('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  rightTab === 'code'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-zinc-300" />
                <span>Source Code</span>
                <span className="text-[10px] font-mono text-zinc-500">({files.length})</span>
              </button>
              <button
                onClick={() => setRightTab('logs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  rightTab === 'logs'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-zinc-300" />
                <span>Diagnostics & Logs</span>
              </button>
            </div>
          </div>

          {/* Right Panel Body */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'preview' && (
              <LivePreviewPanel
                projectId={projectId}
                isRunning={project.status === 'running' || !!activeVersionId}
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

