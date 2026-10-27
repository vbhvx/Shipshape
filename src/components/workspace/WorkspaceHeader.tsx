import React from 'react';
import Link from 'next/link';
import {
  Download,
  RotateCcw,
  ExternalLink,
  Layers,
  Sparkles,
  Server,
  ArrowLeft,
} from 'lucide-react';
import { Project, ProjectVersion } from '@/types';

interface WorkspaceHeaderProps {
  project: Project;
  versions: ProjectVersion[];
  activeVersionId?: string;
  onSelectVersion: (versionId: string) => void;
  onExport: () => void;
  onRestartSandbox: () => void;
  isExporting: boolean;
  isRestarting: boolean;
}

export default function WorkspaceHeader({
  project,
  versions,
  activeVersionId,
  onSelectVersion,
  onExport,
  onRestartSandbox,
  isExporting,
  isRestarting,
}: WorkspaceHeaderProps) {
  const currentVersion = versions.find((v) => v.id === activeVersionId) || versions[0];

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-4 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left: Brand & Navigation */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition p-1.5 rounded-lg hover:bg-zinc-900 text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Projects</span>
        </Link>

        <div className="h-4 w-px bg-zinc-800" />

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center font-bold text-black text-xs shadow-sm shadow-white/10">
            S
          </div>
          <span className="font-semibold text-zinc-100 text-sm tracking-tight truncate max-w-[200px]">
            {project.name}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-900 text-zinc-300 border border-zinc-700/80">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            {project.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Center: Version Selector */}
      <div className="hidden md:flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-400">Version:</span>
          <select
            value={currentVersion?.id || ''}
            onChange={(e) => onSelectVersion(e.target.value)}
            className="bg-transparent text-zinc-200 font-medium focus:outline-none cursor-pointer pr-1"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id} className="bg-zinc-900 text-zinc-100">
                v{v.versionNumber} — {v.changeSummary.slice(0, 30)}
                {v.id === activeVersionId ? ' (Active)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Actions & Providers */}
      <div className="flex items-center gap-2">
        {/* Provider Pills */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
            <Sparkles className="w-3 h-3 text-zinc-300" />
            <span>AI: Built-in Engine</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
            <Server className="w-3 h-3 text-zinc-300" />
            <span>Sandbox: Local Isolated</span>
          </div>
        </div>

        <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

        {/* Action Buttons */}
        <button
          onClick={onRestartSandbox}
          disabled={isRestarting}
          title="Restart Sandbox Runtime"
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin text-white' : ''}`} />
        </button>

        <a
          href={`/api/v1/preview/${project.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open preview in new tab"
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <button
          onClick={onExport}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition shadow-md shadow-white/10 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-black" />
          <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export .zip'}</span>
        </button>
      </div>
    </header>
  );
}
