'use client';

import React, { useState } from 'react';
import { GeneratedFile } from '@/types';
import {
  FileCode,
  Search,
  Copy,
  Check,
  FileText,
  FileJson,
} from 'lucide-react';

interface CodeInspectorPanelProps {
  files: GeneratedFile[];
  selectedFile?: GeneratedFile | null;
  onSelectFile: (file: GeneratedFile) => void;
}

export default function CodeInspectorPanel({
  files,
  selectedFile,
  onSelectFile,
}: CodeInspectorPanelProps) {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(search.toLowerCase())
  );

  const activeFile = selectedFile || files.find((f) => f.path === 'src/app/page.tsx') || files[0];

  const handleCopy = () => {
    if (!activeFile || typeof window === 'undefined') return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (path: string) => {
    if (path.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 text-zinc-300" />;
    if (path.endsWith('.css')) return <FileCode className="w-3.5 h-3.5 text-zinc-300" />;
    if (path.endsWith('.md')) return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
    return <FileCode className="w-3.5 h-3.5 text-zinc-200" />;
  };

  const lines = activeFile ? activeFile.content.split('\n') : [];

  return (
    <div className="h-full flex bg-zinc-950 text-xs">
      {/* Left: File Tree Explorer */}
      <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950/70">
        <div className="p-3 border-b border-zinc-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredFiles.map((f) => {
            const isSelected = activeFile?.path === f.path;
            return (
              <button
                key={f.path}
                onClick={() => onSelectFile(f)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                  isSelected
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {getFileIcon(f.path)}
                  <span className="truncate">{f.path}</span>
                </div>
                {f.isModified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" title="Modified" />
                )}
                {f.isNew && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" title="New" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Code Viewer */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
        {activeFile ? (
          <>
            {/* File Info Bar */}
            <div className="h-10 px-4 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-2 font-mono text-zinc-300">
                {getFileIcon(activeFile.path)}
                <span>{activeFile.path}</span>
                <span className="text-zinc-500 text-[11px]">
                  ({lines.length} lines • {activeFile.sizeBytes || Buffer.byteLength(activeFile.content, 'utf-8')} B)
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-[11px]"
              >
                {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Code Content with Line Numbers */}
            <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed flex">
              {/* Line Numbers */}
              <div className="select-none text-zinc-600 text-right pr-4 border-r border-zinc-800/80 shrink-0">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              {/* Code */}
              <div className="pl-4 text-zinc-200 whitespace-pre overflow-x-auto flex-1">
                {lines.map((line, i) => (
                  <div key={i} className="hover:bg-zinc-900/50">
                    {line || ' '}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500">
            Select a file to inspect its source code.
          </div>
        )}
      </div>
    </div>
  );
}
