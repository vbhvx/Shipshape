'use client';

import React from 'react';
import {
  Cpu,
  RotateCw,
  GitBranch,
  Download,
  FolderGit2,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  ShieldCheck,
} from 'lucide-react';

export default function ArchitectureBento() {
  return (
    <section id="architecture" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-10">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Developer-First Architecture</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
          Runnable by Construction
        </h2>
        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-2xl mx-auto">
          Every build executes in an isolated sandbox, and failures are auto-repaired up to 3 times before you hear about them. Every modification is a verifiable diff.
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Tile 1: Multi-File Synthesis (Span 2 cols on lg) */}
        <div className="lg:col-span-2 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 hover:border-zinc-700 transition p-6 sm:p-7 space-y-5 flex flex-col justify-between shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white">
                <FolderGit2 className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800">
                12–18 Typed Files / App
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Architecture Planning & Multi-File Synthesis
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Instead of dumping code into a single fragile script, Shipshape extracts your entities and routes into a validated specification, then generates a complete, modular Next.js App Router codebase.
            </p>
          </div>

          {/* Micro Visual: Visual File Tree */}
          <div className="rounded-xl bg-zinc-950 border border-zinc-800/90 p-4 font-mono text-xs space-y-2.5 text-zinc-300">
            <div className="text-[10px] text-zinc-500 font-sans uppercase font-bold tracking-wider mb-2">
              Synthesized Codebase Tree
            </div>
            <div className="flex items-center justify-between py-1 px-2 rounded bg-zinc-900/70 border border-zinc-800/60">
              <span className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-zinc-400" />
                <span>src/app/page.tsx</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">App Router Entry</span>
            </div>
            <div className="flex items-center justify-between py-1 px-2 rounded bg-zinc-900/70 border border-zinc-800/60">
              <span className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>src/components/KanbanBoard.tsx</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-sans">Interactive Client Component</span>
            </div>
            <div className="flex items-center justify-between py-1 px-2 rounded bg-zinc-900/70 border border-zinc-800/60">
              <span className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-zinc-400" />
                <span>src/lib/types.ts & store.ts</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">Strict TypeScript Interfaces</span>
            </div>
          </div>
        </div>

        {/* Tile 2: 3-Attempt Automated Repair Loop (Span 1 col on lg) */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/90 hover:border-zinc-700 transition p-6 space-y-5 flex flex-col justify-between shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white">
                <RotateCw className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                1.2 Avg Attempts
              </span>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">
              3-Attempt Automated Repair Loop
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              If TypeScript or Turbopack reports an error, Shipshape passes compiler diagnostics back to the repair engine. Bounded strictly to 3 attempts to prevent infinite loops.
            </p>
          </div>

          {/* Micro Visual: Repair Steps */}
          <div className="rounded-xl bg-zinc-950 border border-zinc-800/90 p-3.5 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-900/50">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Type mismatch: status</span>
              </span>
              <span className="text-[9px] font-bold">ATTEMPT 1</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 bg-zinc-900/60 p-1.5 rounded border border-zinc-800">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-zinc-400" />
                <span>AST patch generator</span>
              </span>
              <span className="text-[9px]">ISOLATED</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-950/40 p-1.5 rounded border border-emerald-900/50">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Clean compile (0 errors)</span>
              </span>
              <span className="text-[9px] font-bold">REPAIRED ✓</span>
            </div>
          </div>
        </div>

        {/* Tile 3: Structured Version Diffs (Span 1 col on lg) */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/90 hover:border-zinc-700 transition p-6 space-y-5 flex flex-col justify-between shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white">
                <GitBranch className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                Immutable History
              </span>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">
              Structured Version Diffs
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Every conversational prompt creates an inspectable diff. Review exact line changes before previewing, and roll back to any prior version with one click.
            </p>
          </div>

          {/* Micro Visual: Unified Diff */}
          <div className="rounded-xl bg-zinc-950 border border-zinc-800/90 p-3 font-mono text-[11px] space-y-1 overflow-x-auto text-zinc-300">
            <div className="text-zinc-500">@@ -12,3 +12,4 @@</div>
            <div className="text-rose-400 bg-rose-950/30 px-1 rounded">- &lt;div className=&quot;text-zinc-400&quot;&gt;All Tasks&lt;/div&gt;</div>
            <div className="text-emerald-400 bg-emerald-950/40 px-1 rounded">+ &lt;div className=&quot;font-bold&quot;&gt;Active Sprint Tasks&lt;/div&gt;</div>
            <div className="text-emerald-400 bg-emerald-950/40 px-1 rounded">+ &lt;Badge variant=&quot;urgent&quot;&gt;Due Today&lt;/Badge&gt;</div>
          </div>
        </div>

        {/* Tile 4: Isolated Sandbox & Zero Lock-in Export (Span 2 cols on lg) */}
        <div className="lg:col-span-2 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 hover:border-zinc-700 transition p-6 sm:p-7 space-y-5 flex flex-col justify-between shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/60 flex items-center gap-1.5">
                <Download className="w-3 h-3 text-emerald-400" />
                <span>Zero Lock-In (.zip)</span>
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Sandboxed Runtime with Clean Source Export
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Every application runs in an isolated workspace with safe port allocation and automatic secret scrubbing. When you are satisfied, download a complete, standalone `.zip` archive ready for `npm install && npm run dev` or immediate Vercel deployment.
            </p>
          </div>

          {/* Micro Visual: Terminal + Download Action */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-black border border-zinc-800 font-mono text-[11px] space-y-1 text-zinc-400">
              <div className="text-emerald-400 flex items-center gap-1.5 font-bold">
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span>SANDBOX ISOLATION</span>
              </div>
              <div>Runtime: Node 20 + Next.js 16</div>
              <div>Port: Dedicated auto-allocated port</div>
              <div>Secrets: Scrubbed before logs</div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between text-xs">
              <div className="space-y-1">
                <div className="font-bold text-zinc-200">Production-Ready Archive</div>
                <div className="text-[11px] text-zinc-400">
                  Clean package.json, TypeScript config, and README with zero proprietary dependencies.
                </div>
              </div>
              <div className="text-[11px] font-mono text-emerald-400 font-semibold pt-2">
                100% Code Ownership under MIT
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
