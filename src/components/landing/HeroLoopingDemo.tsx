'use client';

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Terminal,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';

const STEPS = [
  {
    id: 'prompt',
    title: '1. Prompt',
    subtitle: 'Natural language input',
    duration: 3500,
  },
  {
    id: 'plan',
    title: '2. Architecture',
    subtitle: '14 files & routes planned',
    duration: 3500,
  },
  {
    id: 'sandbox',
    title: '3. Sandbox Build',
    subtitle: 'Isolated Turbopack compile',
    duration: 3500,
  },
  {
    id: 'preview',
    title: '4. Live Preview',
    subtitle: 'Interactive Next.js app',
    duration: 4500,
  },
];

export default function HeroLoopingDemo() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (!isPlaying) return;

    const currentDuration = STEPS[currentStep].duration;
    const intervalTime = 50;
    const increment = (intervalTime / currentDuration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setCurrentStep((s) => (s + 1) % STEPS.length);
          return 0;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, currentStep]);

  const handleStepClick = (idx: number) => {
    setCurrentStep(idx);
    setProgress(0);
  };

  return (
    <div className="w-full rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col font-sans">
      {/* Window Titlebar */}
      <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-zinc-700/80" />
            <span className="w-3 h-3 rounded-full bg-zinc-700/80" />
            <span className="w-3 h-3 rounded-full bg-zinc-700/80" />
          </div>
          <span className="text-xs font-mono text-zinc-300 ml-2 font-medium">
            Shipshape Pipeline • Prompt to Live Preview (14s)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause simulation' : 'Play simulation'}
            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => {
              setCurrentStep(0);
              setProgress(0);
            }}
            title="Restart demo"
            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pipeline Stepper Bar */}
      <div className="grid grid-cols-4 border-b border-zinc-800/80 bg-zinc-900/40 text-[11px]">
        {STEPS.map((s, idx) => {
          const isActive = currentStep === idx;
          const isPassed = currentStep > idx;
          return (
            <button
              key={s.id}
              onClick={() => handleStepClick(idx)}
              className={`p-2.5 text-left border-r last:border-r-0 border-zinc-800/80 transition relative cursor-pointer ${
                isActive
                  ? 'bg-zinc-900 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {isPassed ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                    }`}
                  />
                )}
                <span className="truncate">{s.title}</span>
              </div>

              {/* Progress bar under active step */}
              {isActive && (
                <div
                  className="absolute bottom-0 left-0 h-0.5 bg-emerald-400 transition-all duration-75"
                  style={{ width: `${progress}%` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Visual Content Stage */}
      <div className="p-4 sm:p-5 min-h-[260px] flex flex-col justify-between bg-zinc-950">
        {/* Step 0: Prompt Input */}
        {currentStep === 0 && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Prompt Analysis & Entity Extraction
              </span>
              <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                Token Count: 48
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 font-mono text-xs text-zinc-200 leading-relaxed">
              <span className="text-emerald-400">&gt; </span>
              &ldquo;Build a high-performance Kanban board with drag-and-drop workflow, task priorities, status metrics, dark mode, and CSV export.&rdquo;
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono">
              <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-zinc-300">
                <span className="text-zinc-500 block text-[9px]">TARGET ROUTE</span>
                /workspace/kanban
              </div>
              <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-zinc-300">
                <span className="text-zinc-500 block text-[9px]">ENTITIES</span>
                Task, Column, Tag
              </div>
              <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-zinc-300">
                <span className="text-zinc-500 block text-[9px]">PERSISTENCE</span>
                Local IndexedDB/CSV
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Architecture Plan */}
        {currentStep === 1 && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Structured Architecture Specification
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                Schema Validated ✓
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-300 font-semibold">Planned Next.js App Router Structure</span>
                <span className="text-zinc-400">14 Files Synthesized</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400">
                <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                  <span className="text-emerald-400 font-bold">+</span> src/app/page.tsx
                </div>
                <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                  <span className="text-emerald-400 font-bold">+</span> components/KanbanColumn.tsx
                </div>
                <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                  <span className="text-emerald-400 font-bold">+</span> components/TaskCard.tsx
                </div>
                <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                  <span className="text-emerald-400 font-bold">+</span> lib/types.ts & store.ts
                </div>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Strict TypeScript types verified against Zod schema definitions</span>
            </div>
          </div>
        )}

        {/* Step 2: Sandbox Build */}
        {currentStep === 2 && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                Isolated Sandbox Build & Auto-Repair
              </span>
              <span className="text-[10px] font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                Port 3001
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-black border border-zinc-800/90 font-mono text-[11px] text-zinc-300 space-y-1.5 overflow-x-auto shadow-inner">
              <div className="text-zinc-500">$ next dev --turbopack -p 3001</div>
              <div className="text-zinc-400">▲ Next.js 16.4.3 (Turbopack)</div>
              <div className="text-emerald-400">✓ Compiled / in 435ms</div>
              <div className="text-zinc-300">✓ TypeScript typecheck passed (0 errors)</div>
              <div className="text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Ready in 12.4s • http://localhost:3001</span>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Diagnostic check clean. 0 syntax or import errors detected.</span>
            </div>
          </div>
        )}

        {/* Step 3: Live Preview */}
        {currentStep === 3 && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                Live Sandboxed App Running
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded flex items-center gap-1">
                <span>localhost:3001</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </div>

            {/* Mini Kanban UI Preview Card */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3.5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-zinc-100">SprintFlow Kanban</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono">
                    8 Tasks
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded font-medium">
                    100% Client-Safe
                  </span>
                </div>
              </div>

              {/* 3 Columns Preview */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 space-y-1.5">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    To Do (3)
                  </div>
                  <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200">
                    Design Schema
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 space-y-1.5">
                  <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                    In Progress (2)
                  </div>
                  <div className="p-1.5 rounded bg-zinc-900 border border-emerald-900/60 text-[10px] text-zinc-200">
                    Turbopack Compile
                  </div>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 space-y-1.5">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Done (3)
                  </div>
                  <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 line-through">
                    Scaffold Sandbox
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Ready to inspect, diff, or download as .zip</span>
              <span className="font-mono text-emerald-400 text-[10px]">Zero lock-in</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
