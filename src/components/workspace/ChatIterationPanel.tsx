'use client';

import React, { useState, useMemo } from 'react';
import { Send, Sparkles, Loader2, Zap, XCircle, User, Bot } from 'lucide-react';
import { GenerationEvent, GenerationRun } from '@/types';

interface ChatIterationPanelProps {
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
  activeRun?: GenerationRun | null;
  events?: GenerationEvent[];
  onCancelRun?: () => void;
  prompt?: string;
  projectName?: string;
}

export default function ChatIterationPanel({
  onSendMessage,
  isProcessing,
  activeRun,
  events = [],
  onCancelRun,
  prompt,
  projectName,
}: ChatIterationPanelProps) {
  const [input, setInput] = useState('');

  const quickPrompts = [
    'Add dark mode toggle and persistence',
    'Add status badge filters and search input',
    'Add CSV and JSON data export buttons',
    'Improve mobile responsiveness and card spacing',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const progressSteps = [
    { key: 'planning', label: '1. Plan' },
    { key: 'generating', label: '2. Code' },
    { key: 'validating', label: '3. Valid' },
    { key: 'repairing', label: '4. Repair' },
    { key: 'starting_sandbox', label: '5. Exec' },
    { key: 'completed', label: '6. Ready' },
  ];

  const getStepIndex = (status?: string) => {
    switch (status) {
      case 'planning':
        return 1;
      case 'generating':
        return 2;
      case 'validating':
        return 3;
      case 'repairing':
        return 4;
      case 'starting_sandbox':
        return 5;
      case 'completed':
        return 6;
      default:
        return 0;
    }
  };

  const currentStatus = activeRun?.status;
  const activeStepIdx = getStepIndex(currentStatus);

  // Strictly deduplicate event stream to prevent identical log messages
  const uniqueEvents = useMemo(() => {
    const seen = new Set<string>();
    const result: GenerationEvent[] = [];
    for (const evt of events) {
      const key = `${evt.eventType}:${evt.message.trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(evt);
      }
    }
    return result;
  }, [events]);

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-r border-zinc-800">
      {/* Top Banner / Run Status Tracker */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-200">Engineering Agent & Iteration</span>
          </div>
          {isProcessing && onCancelRun && (
            <button
              onClick={onCancelRun}
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-zinc-800 transition flex items-center gap-1 cursor-pointer"
            >
              <XCircle className="w-3 h-3 text-zinc-400" />
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
                  isCurrent
                    ? 'bg-white text-black font-bold shadow-sm'
                    : isCompleted
                    ? 'bg-zinc-800 text-zinc-200 font-semibold border border-zinc-700/60'
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
        {/* User Prompt Echo Bubble */}
        {prompt && (
          <div className="flex gap-2.5 items-start">
            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm p-3.5 space-y-1">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Initial Requirements</div>
              <p className="text-xs text-zinc-200 leading-relaxed">{prompt}</p>
            </div>
          </div>
        )}

        {/* Assistant Response Summary Bubble */}
        {prompt && (
          <div className="flex gap-2.5 items-start">
            <div className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl rounded-tl-sm p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-zinc-200">Shipshape AI Engineering Assistant</span>
                <span className="text-zinc-500 font-mono">Synthesized Architecture</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                I synthesized a tailored Next.js App Router codebase for <span className="text-white font-semibold">{projectName || 'your application'}</span> with domain-specific entities, interactive checklist controls, local storage persistence, and verified compilation.
              </p>
            </div>
          </div>
        )}

        {uniqueEvents.length === 0 && !prompt ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-3">
            <Zap className="w-8 h-8 text-zinc-500" />
            <div className="text-sm font-medium text-zinc-300">Describe or iterate on your application</div>
            <p className="text-xs text-zinc-500 max-w-xs">
              Submit requirements or request iterative modifications. Shipshape will analyze the code, compute targeted diffs, and test the build automatically.
            </p>
          </div>
        ) : (
          uniqueEvents.map((evt) => (
            <div
              key={evt.id}
              className={`p-3 rounded-xl border text-xs leading-relaxed transition-all ${
                evt.eventType === 'error'
                  ? 'bg-zinc-950 border-rose-900/80 text-rose-300 border-l-2 border-l-rose-500'
                  : evt.eventType === 'preview_ready' || evt.eventType === 'step_completed'
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                  : 'bg-zinc-900/80 border-zinc-800 text-zinc-300'
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
              className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 text-[11px] transition text-left disabled:opacity-50 cursor-pointer"
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
            className="w-full pl-3.5 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 rounded-lg bg-white hover:bg-zinc-200 text-black disabled:opacity-30 disabled:bg-zinc-800 transition flex items-center justify-center shadow-md shadow-white/10 cursor-pointer"
          >
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-black" /> : <Send className="w-3.5 h-3.5 text-black" />}
          </button>
        </div>
      </form>
    </div>
  );
}
