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
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-zinc-200">Diagnostics & Execution Logs</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              hasErrors
                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
            }`}
          >
            {hasErrors ? 'ATTENTION REQUIRED' : 'HEALTHY / VERIFIED'}
          </span>
        </div>

        {hasErrors && onTriggerRepair && (
          <button
            onClick={onTriggerRepair}
            disabled={isRepairing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition shadow-md shadow-amber-600/30 disabled:opacity-50"
          >
            <Wrench className="w-3.5 h-3.5" />
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
                  ? 'bg-rose-950/20 border-rose-800/60'
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-mono uppercase font-semibold text-zinc-300">{b.checkType}</span>
                <span className={b.status === 'passed' ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                  {b.status.toUpperCase()}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500">
                Duration: {b.durationMs}ms • Exit code: {b.exitCode}
              </div>
              {b.errors && b.errors.length > 0 && (
                <div className="mt-2 text-[11px] text-rose-300 font-mono bg-rose-950/40 p-2 rounded border border-rose-900/60">
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
                  ? 'text-rose-400 font-semibold'
                  : l.streamType === 'system'
                  ? 'text-cyan-400'
                  : 'text-zinc-300'
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
