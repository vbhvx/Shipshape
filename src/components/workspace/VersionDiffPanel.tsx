'use client';

import React, { useState, useEffect } from 'react';
import { ProjectVersion, VersionDiff } from '@/types';
import { projectsApi } from '@/lib/api/projects';
import { describeError } from '@/lib/api/client';
import { RotateCcw, History } from 'lucide-react';

interface VersionDiffPanelProps {
  projectId: string;
  versions: ProjectVersion[];
  activeVersionId?: string;
  onRestoreVersion: (versionId: string) => void;
  isRestoring?: boolean;
}

export default function VersionDiffPanel({
  projectId,
  versions,
  activeVersionId,
  onRestoreVersion,
  isRestoring,
}: VersionDiffPanelProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    activeVersionId || versions[versions.length - 1]?.id || ''
  );
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Loads the diff when the version changes. Choosing a file only changes what is shown,
  // so it is not a dependency (it used to refetch the whole diff on every click).
  useEffect(() => {
    if (!selectedVersionId) return;
    let ignore = false;
    setLoadingDiff(true);
    setDiffError(null);
    projectsApi
      .diff(projectId, selectedVersionId)
      .then((next) => {
        if (ignore) return;
        setDiff(next);
        setSelectedFilePath(next.files[0]?.path ?? null);
      })
      .catch((err) => {
        if (!ignore) setDiffError(describeError(err, 'Could not load this version\'s changes.'));
      })
      .finally(() => {
        if (!ignore) setLoadingDiff(false);
      });
    return () => {
      ignore = true;
    };
  }, [projectId, selectedVersionId]);

  const selectedFileDiff = diff?.files.find((f) => f.path === selectedFilePath);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-xs">
      {/* Top: Version List / Selector */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/40 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-200">
            <History className="w-4 h-4 text-zinc-300" />
            <span>Version History & Snapshot Diffs</span>
          </div>
          {selectedVersionId && selectedVersionId !== activeVersionId && (
            <button
              onClick={() => onRestoreVersion(selectedVersionId)}
              disabled={isRestoring}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-[11px] flex items-center gap-1 transition shadow-md shadow-white/10 disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3 text-black" />
              {isRestoring ? 'Restoring...' : 'Restore This Version'}
            </button>
          )}
        </div>

        {/* Versions Carousel / Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {versions.map((v) => {
            const isSelected = v.id === selectedVersionId;
            const isActive = v.id === activeVersionId;
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className={`px-3 py-2 rounded-xl border text-left shrink-0 transition-all ${
                  isSelected
                    ? 'bg-zinc-800 border-zinc-600 text-white shadow-md'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <span>v{v.versionNumber}</span>
                  {isActive && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-zinc-800 text-zinc-200 border border-zinc-700">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 truncate max-w-[160px] mt-0.5">
                  {v.changeSummary}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  {new Date(v.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Diff Explorer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Changed Files List */}
        <div className="w-48 border-r border-zinc-800 overflow-y-auto bg-zinc-950/60 p-2 space-y-1">
          <div className="text-[10px] uppercase font-semibold text-zinc-500 px-2 py-1">
            Changed Files ({diff?.summary.filesChanged || 0})
          </div>

          {loadingDiff ? (
            <div className="text-zinc-500 p-2">Computing diff...</div>
          ) : diffError ? (
            <div role="alert" className="text-zinc-400 p-2">{diffError}</div>
          ) : !diff || diff.files.length === 0 ? (
            <div className="text-zinc-500 p-2">No file differences.</div>
          ) : (
            diff.files.map((f) => {
              const isSelected = f.path === selectedFilePath;
              return (
                <button
                  key={f.path}
                  onClick={() => setSelectedFilePath(f.path)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs truncate flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate">{f.path.split('/').pop()}</span>
                  <div className="flex items-center gap-1 text-[10px] shrink-0 font-mono">
                    {f.additions > 0 && <span className="text-zinc-200 font-semibold">+{f.additions}</span>}
                    {f.deletions > 0 && <span className="text-zinc-500">-{f.deletions}</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Line-by-Line Diff Viewer */}
        <div className="flex-1 overflow-auto bg-zinc-950 font-mono text-[11px] p-4">
          {selectedFileDiff ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                <span className="text-zinc-200 font-semibold">{selectedFileDiff.path}</span>
                <span className="px-2 py-0.5 rounded uppercase text-[10px] bg-zinc-800 text-zinc-400">
                  {selectedFileDiff.status}
                </span>
              </div>

              {selectedFileDiff.status === 'unchanged' ? (
                <div className="text-zinc-500 italic py-4">File is identical to base version.</div>
              ) : selectedFileDiff.hunks && selectedFileDiff.hunks.length > 0 ? (
                <div className="rounded-lg overflow-hidden border border-zinc-800/80 bg-zinc-900/60 divide-y divide-zinc-800/40">
                  {selectedFileDiff.hunks.map((hunk, hIdx) => (
                    <div key={hIdx} className="space-y-0.5">
                      <div className="px-3 py-1 bg-zinc-800/60 text-zinc-300 text-[10px] select-none font-mono">
                        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                      </div>
                      {hunk.lines.map((line, lIdx) => {
                        const isAdd = line.startsWith('+');
                        const isDel = line.startsWith('-');
                        return (
                          <div
                            key={lIdx}
                            className={`px-3 py-0.5 whitespace-pre flex gap-2 ${
                              isAdd
                                ? 'bg-zinc-800/60 text-zinc-100 font-medium'
                                : isDel
                                ? 'bg-zinc-900/60 text-zinc-500 line-through'
                                : 'text-zinc-400'
                            }`}
                          >
                            <span className="w-3 select-none text-zinc-600">{isAdd ? '+' : isDel ? '-' : ' '}</span>
                            <span className="flex-1 overflow-x-auto">{line.slice(1)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="text-zinc-300 whitespace-pre-wrap">{selectedFileDiff.newContent}</pre>
              )}
            </div>
          ) : (
            <div className="text-zinc-500 py-8 text-center">Select a file to inspect diff.</div>
          )}
        </div>
      </div>
    </div>
  );
}
