'use client';

import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  Loader2,
  XCircle,
  Zap,
} from 'lucide-react';
import { GenerationRun, GenerationEvent } from '@/types';

interface ChatIterationPanelProps {
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
  activeRun?: GenerationRun | null;
  events: GenerationEvent[];
  onCancelRun?: () => void;
}

export default function ChatIterationPanel({
  onSendMessage,
  isProcessing,
  activeRun,
  events,
  onCancelRun,
}: ChatIterationPanelProps) {
  const [input, setInput] = useState('');

  const quickPrompts = [
    'Add a priority filter and category sorting',
    'Add an interactive CSV export button',
    'Enhance dark mode with high-contrast slate colors',
    'Add notification toast alerts on record update',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const currentStatus = activeRun?.status || 'idle';
  const progressSteps = [
    { key: 'planning', label: '1. Plan' },
    { key: 'generating', label: '2. Generate' },
    { key: 'validating', label: '3. Validate' },
    { key: 'building', label: '4. Build' },
    { key: 'starting', label: '5. Runtime' },
    { key: 'preview_ready', label: '6. Preview' },
  ];

  const getStepIndex = (status: string) => {
    const map: Record<string, number> = {
      queued: 0,
      planning: 1,
      generating: 2,
      validating: 3,
      installing: 3,
      building: 4,
      starting: 5,
      preview_ready: 6,
      completed: 6,
      repairing: 4,
    };
    return map[status] ?? 0;
  };

  const activeStepIdx = getStepIndex(currentStatus);

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-r border-zinc-800">
      {/* Top Banner / Run Status Tracker */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-zinc-200">Engineering Agent & Iteration</span>
          </div>
          {isProcessing && onCancelRun && (
            <button
              onClick={onCancelRun}
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-950 text-rose-400 border border-rose-800/80 hover:bg-rose-900 transition flex items-center gap-1"
            >
              <XCircle className="w-3 h-3" />
              Cancel Run
            </button>
          )}
        </div>

        {/* Stepper Bar */}
        <div className="grid grid-cols-6 gap-1 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800/80 text-[10px] font-medium text-center">
          {progressSteps.map((step, idx) => {
            const isCompleted = activeStepIdx > idx + 1 || currentStatus === 'completed';
            const isCurrent = activeStepIdx === idx + 1;
            return (
              <div
                key={step.key}
                className={`py-1 rounded transition-colors ${
                  isCompleted
                    ? 'bg-emerald-950/80 text-emerald-400 font-semibold'
                    : isCurrent
                    ? 'bg-indigo-600 text-white font-bold animate-pulse'
                    : 'text-zinc-600'
                }`}
              >
                {step.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Events / Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans text-xs">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-3">
            <Zap className="w-8 h-8 text-indigo-500/40" />
            <div className="text-sm font-medium text-zinc-400">Describe or iterate on your application</div>
            <p className="text-xs text-zinc-500 max-w-xs">
              Submit requirements or request iterative modifications. Shipshape will analyze the code, compute targeted diffs, and test the build automatically.
            </p>
          </div>
        ) : (
          events.map((evt) => (
            <div
              key={evt.id}
              className={`p-3 rounded-xl border text-xs leading-relaxed transition-all ${
                evt.eventType === 'error'
                  ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                  : evt.eventType === 'preview_ready' || evt.eventType === 'step_completed'
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                  : evt.eventType === 'repair_attempt'
                  ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                <span className="font-mono uppercase tracking-wider">{evt.eventType.replace('_', ' ')}</span>
                <span>{new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div className="font-medium">{evt.message}</div>
            </div>
          ))
        )}
      </div>

      {/* Quick Prompts Suggestions */}
      <div className="px-4 py-2 bg-zinc-900/30 border-t border-zinc-800/60">
        <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider mb-1.5">
          Quick Iterations:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((q) => (
            <button
              key={q}
              onClick={() => onSendMessage(q)}
              disabled={isProcessing}
              className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 text-[11px] transition text-left disabled:opacity-50"
            >
              + {q}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800 bg-zinc-950">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder={isProcessing ? 'Agent is working on code...' : 'Instruct agent to modify code, add features, or fix errors...'}
            className="w-full pl-3.5 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 disabled:bg-zinc-800 transition flex items-center justify-center shadow-md shadow-indigo-600/20"
          >
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
