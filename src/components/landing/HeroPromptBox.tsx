'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, Loader2, Layout, Users, ShoppingBag } from 'lucide-react';

interface PromptChip {
  id: string;
  name: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const EXAMPLE_CHIPS: PromptChip[] = [
  {
    id: 'kanban',
    name: 'SprintFlow Kanban',
    label: 'Kanban Sprint Board',
    icon: <Layout className="w-3.5 h-3.5 text-emerald-400" />,
    prompt:
      'Build a high-performance Kanban sprint task management application with drag-and-drop workflow columns, priority tagging, status metrics, dark mode, real-time client persistence, and CSV export.',
  },
  {
    id: 'crm',
    name: 'Veloce Venture CRM',
    label: 'B2B SaaS CRM',
    icon: <Users className="w-3.5 h-3.5 text-emerald-400" />,
    prompt:
      'Build an early-stage venture capital deal pipeline CRM tracking startup funding rounds, syndicate partners, founder evaluation notes, valuation metrics, and portfolio ROI.',
  },
  {
    id: 'store',
    name: 'Velour Fragrance Store',
    label: 'Headless Boutique Store',
    icon: <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />,
    prompt:
      'Design a modern luxury boutique catalog with interactive product filtering, shopping cart drawer with live subtotal calculation, inventory stock tracking, and checkout simulation.',
  },
];

export default function HeroPromptBox() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectChip = (chip: PromptChip) => {
    setSelectedChipId(chip.id);
    setPrompt(chip.prompt);
    setProjectName(chip.name);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const finalName =
      projectName.trim() ||
      prompt
        .trim()
        .slice(0, 24)
        .replace(/[^a-zA-Z0-9 ]/g, '') ||
      'New Project';

    try {
      // 1. Create Project
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: finalName, description: prompt.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create project');

      const projectId = json.project.id;

      // 2. Trigger Generation Pipeline Run in the background
      await fetch(`/api/v1/projects/${projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      // 3. Navigate into the Workspace
      router.push(`/workspace/${projectId}`);
    } catch (err: any) {
      console.error('Failed to create project from hero:', err);
      setError(err.message || 'Something went wrong creating your project. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full rounded-2xl bg-zinc-900/90 border border-zinc-700/80 p-5 sm:p-6 shadow-2xl backdrop-blur relative overflow-hidden group hover:border-zinc-500 transition-all">
      {/* Subtle emerald glowing top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-700 via-emerald-400 to-zinc-700 opacity-80" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Interactive Builder Prompt
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
            Next.js App Router
          </span>
        </div>

        {/* Textarea Input */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setSelectedChipId(null);
              if (error) setError(null);
            }}
            rows={4}
            placeholder="Describe what you want to build (e.g. Build a high-performance Kanban board with drag-and-drop workflow, task priorities, status metrics, dark mode, and CSV export)..."
            className="w-full rounded-xl bg-zinc-950/90 border border-zinc-700/90 p-3.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 transition resize-none leading-relaxed"
          />
        </div>

        {/* Example Chips */}
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-zinc-400">
            Or pick an architectural blueprint:
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_CHIPS.map((chip) => {
              const isSelected = selectedChipId === chip.id;
              return (
                <button
                  type="button"
                  key={chip.id}
                  onClick={() => handleSelectChip(chip)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                    isSelected
                      ? 'bg-zinc-800 text-white border-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.15)]'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-800/80 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  {chip.icon}
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Runs in isolated sandbox • Full .zip export</span>
          </div>

          <button
            type="submit"
            disabled={!prompt.trim() || isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs sm:text-sm font-bold shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Initializing Workspace...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Start building</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
