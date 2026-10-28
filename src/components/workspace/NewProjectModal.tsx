'use client';

import React, { useState } from 'react';
import { Sparkles, X, Layout, BarChart3, ShoppingBag, Users, ArrowRight, Loader2 } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

export default function NewProjectModal({
  isOpen,
  onClose,
  onCreated,
}: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const starterTemplates = [
    {
      title: 'Kanban Sprint Board',
      icon: <Layout className="w-4 h-4 text-emerald-400" />,
      desc: 'High-performance sprint board with drag-and-drop columns, task priorities, live stats, and CSV export.',
    },
    {
      title: 'AI Analytics & Forecasts',
      icon: <BarChart3 className="w-4 h-4 text-emerald-400" />,
      desc: 'Real-time KPI metrics, performance distribution bars, category analytics, and trend forecasting.',
    },
    {
      title: 'E-Commerce Product Hub',
      icon: <ShoppingBag className="w-4 h-4 text-emerald-400" />,
      desc: 'Interactive product catalog, shopping cart calculation, inventory tracking, and discount workflows.',
    },
    {
      title: 'Customer Deal CRM',
      icon: <Users className="w-4 h-4 text-emerald-400" />,
      desc: 'Lead tracking, deal pipeline stages, client contact records, and revenue analytics dashboard.',
    },
  ];

  const handleSelectStarter = (starter: { title: string; desc: string }) => {
    setName(starter.title);
    setDescription(starter.desc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      setError('Please provide both a project name and product description.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 1. Create Project
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create project');

      const projectId = json.project.id;

      // 2. Generate Initial Plan & Start Generation Run
      await fetch(`/api/v1/projects/${projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: description.trim() }),
      });

      onCreated(projectId);
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the project.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-black font-bold text-xs shadow-md shadow-white/10">
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Start building new project</h2>
              <p className="text-xs text-zinc-400">Transform natural language into an executable Next.js codebase.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Quick Starter Cards */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
              Or pick an architectural blueprint:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {starterTemplates.map((starter) => (
                <button
                  type="button"
                  key={starter.title}
                  onClick={() => handleSelectStarter(starter)}
                  className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-500 hover:bg-zinc-800/40 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 group-hover:text-white">
                    {starter.icon}
                    <span>{starter.title}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{starter.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Project Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. DevPulse Ops Platform"
                className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Describe requirements in plain language *
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the application's purpose, key features, target users, pages, and interactive workflows..."
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-400 resize-none leading-relaxed transition"
              />
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold shadow-lg shadow-white/10 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                  <span>Synthesizing Codebase...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Start building</span>
                  <ArrowRight className="w-3.5 h-3.5 text-black" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
