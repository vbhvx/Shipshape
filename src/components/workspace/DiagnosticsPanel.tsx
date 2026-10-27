'use client';

import React from 'react';
import { BuildLog, BuildCheckResult } from '@/types';
import { Terminal, Wrench } from 'lucide-react';

interface DiagnosticsPanelProps {
  logs: BuildLog[];
  buildResults: BuildCheckResult[];
  onTriggerRepair?: () => void;
  isRepairing?: boolean;
}

export default function DiagnosticsPanel({
  logs,
  buildResults,
  onTriggerRepair,
  isRepairing,
}: DiagnosticsPanelProps) {
  const hasErrors = buildResults.some((b) => b.status === 'failed') || logs.some((l) => l.streamType === 'stderr');

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-xs">
      {/* Top Diagnostics Status Bar */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-zinc-300" />
          <span className="font-semibold text-zinc-200">Diagnostics & Execution Logs</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-900 text-zinc-300 border border-zinc-700/80">
            {hasErrors ? 'ATTENTION REQUIRED' : 'HEALTHY / VERIFIED'}
          </span>
        </div>

        {hasErrors && onTriggerRepair && (
          <button
            onClick={onTriggerRepair}
            disabled={isRepairing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition shadow-md shadow-white/10 disabled:opacity-50"
          >
            <Wrench className="w-3.5 h-3.5 text-black" />
            <span>{isRepairing ? 'Repairing...' : 'Auto-Repair with AI Agent'}</span>
          </button>
        )}
      </div>

      {/* Build Results Cards */}
      {buildResults.length > 0 && (
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {buildResults.map((b) => (
            <div
              key={b.id}
              className={`p-3 rounded-xl border ${
                b.status === 'failed'
                  ? 'bg-zinc-900/90 border-zinc-700'
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-mono uppercase font-semibold text-zinc-300">{b.checkType}</span>
                <span className={b.status === 'passed' ? 'text-zinc-200 font-semibold' : 'text-zinc-400 font-bold'}>
                  {b.status.toUpperCase()}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500">
                Duration: {b.durationMs}ms • Exit code: {b.exitCode}
              </div>
              {b.errors && b.errors.length > 0 && (
                <div className="mt-2 text-[11px] text-zinc-300 font-mono bg-zinc-950 p-2 rounded border border-zinc-800">
                  {b.errors[0].message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Terminal Logs Output */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-1 bg-black/90">
        {logs.length === 0 ? (
          <div className="text-zinc-600 italic py-6 text-center">
            No execution logs recorded yet. Build and sandbox output will stream here.
          </div>
        ) : (
          logs.map((l) => (
            <div
              key={l.id}
              className={`leading-relaxed ${
                l.streamType === 'stderr'
                  ? 'text-zinc-200 font-semibold'
                  : l.streamType === 'system'
                  ? 'text-white'
                  : 'text-zinc-400'
              }`}
            >
              <span className="text-zinc-600 select-none mr-2">
                [{new Date(l.timestamp).toLocaleTimeString()}]
              </span>
              <span>{l.content}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
