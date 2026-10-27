'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Project } from '@/types';
import {
  Sparkles,
  Send,
  ArrowRight,
  ArrowLeft,
  Layout,
  BarChart3,
  ShoppingBag,
  Users,
  Loader2,
  FolderGit2,
  Download,
  Trash2,
  Zap,
  Bot,
  MessageSquare,
  Code2,
} from 'lucide-react';

export default function ApplicationsChatPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Conversational message history
  const [chatMessages, setChatMessages] = useState<
    { role: 'assistant' | 'user'; text: string; timestamp: string; step?: string }[]
  >([
    {
      role: 'assistant',
      text: "Hello! I am your Shipshape AI Engineering Assistant. What are we building today? Describe your application idea below or pick an architectural blueprint to start.",
      timestamp: 'Just now',
    },
  ]);

  const quickStarters = [
    {
      title: 'Kanban Sprint Board',
      icon: <Layout className="w-4 h-4 text-white" />,
      name: 'SprintFlow Kanban',
      prompt: 'Build a high-performance Kanban and sprint task management application with drag-and-drop workflow columns, priority tagging, status metrics, dark mode, real-time client persistence, and CSV export.',
    },
    {
      title: 'AI Analytics & Latency Telemetry',
      icon: <BarChart3 className="w-4 h-4 text-white" />,
      name: 'PulseMetrics Observability',
      prompt: 'Create an AI inference and KPI analytics dashboard with dynamic progress breakdown bars, model accuracy charts, latency monitoring, and CSV reporting.',
    },
    {
      title: 'Luxury Boutique E-Commerce Store',
      icon: <ShoppingBag className="w-4 h-4 text-white" />,
      name: 'Velour Fragrance Store',
      prompt: 'Design a modern luxury boutique catalog with interactive product filtering, shopping cart drawer with live subtotal calculation, inventory stock tracking, and checkout simulation.',
    },
    {
      title: 'Venture Capital Deal CRM',
      icon: <Users className="w-4 h-4 text-white" />,
      name: 'Veloce Deal Pipeline',
      prompt: 'Build an early-stage venture capital deal pipeline CRM tracking startup funding rounds, syndicate partners, founder evaluation notes, valuation metrics, and portfolio ROI.',
    },
  ];

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      const res = await fetch('/api/v1/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleSelectStarter = (starter: typeof quickStarters[0]) => {
    setProjectName(starter.name);
    setPrompt(starter.prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isSubmitting) {
        handleStartGeneration(e);
      }
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
      const res = await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleExportZip = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      setExportingId(id);
      const res = await fetch(`/api/v1/projects/${id}/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-source.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download source:', err);
      alert('Failed to download project source code');
    } finally {
      setExportingId(null);
    }
  };

  const handleStartGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    const finalName =
      projectName.trim() ||
      prompt
        .trim()
        .slice(0, 24)
        .replace(/[^a-zA-Z0-9 ]/g, '') ||
      'New Application';

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add user message to chat UI
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'user',
        text: prompt.trim(),
        timestamp,
      },
      {
        role: 'assistant',
        text: `Starting synthesis for "${finalName}"... Interpreting requirements, designing schema & Next.js App Router structure, and setting up isolated sandbox live preview.`,
        timestamp: 'Just now',
        step: 'Initializing agentic pipeline...',
      },
    ]);

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

      // 2. Trigger Generation Pipeline Run
      await fetch(`/api/v1/projects/${projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      // Redirect into the deep-linkable workspace
      router.push(`/workspace/${projectId}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the application.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950/80 text-zinc-100 font-sans selection:bg-zinc-200 selection:text-black bg-grid-crosshair relative">
      {/* Ambient Lighting Orbs - Coordinated with Theme */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[380px] bg-indigo-600/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-60 right-1/4 w-[500px] h-[320px] bg-cyan-500/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 text-xs font-medium border border-transparent hover:border-zinc-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Overview</span>
            </Link>

            <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-indigo-600/30">
                S
              </div>
              <div>
                <span className="font-bold text-zinc-100 text-sm tracking-tight">Shipshape</span>
                <span className="hidden sm:inline-block ml-2 text-[11px] text-zinc-400 font-mono">
                  / Chat Studio
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-zinc-900 text-zinc-300 border border-zinc-800">
              <MessageSquare className="w-3 h-3 text-zinc-400" />
              <span>Conversational Builder</span>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-900 text-zinc-200 border border-zinc-700/80">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              AI Agent Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Chat Stage */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col justify-between space-y-8 relative z-10">
        {/* Chat History Container */}
        <div className="space-y-6">
          {/* Greeting Hero Message Bubble */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 shadow-lg font-bold">
              <Bot className="w-5 h-5 text-zinc-100" />
            </div>
            <div className="space-y-3 max-w-2xl w-full">
              <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-3 backdrop-blur">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                    Shipshape Autonomous Agent
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">Next.js 16 • React 19</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  What are we building today?
                </h1>

                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  Tell me what application you want to build in plain English. I will extract data
                  models, synthesize a full-stack multi-file Next.js + TypeScript codebase, launch an
                  isolated sandbox preview, and repair any errors automatically.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    <Zap className="w-3 h-3 text-zinc-300" /> Instant Sandbox
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    <Code2 className="w-3 h-3 text-zinc-300" /> Full Source Code
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    <Download className="w-3 h-3 text-zinc-300" /> Zip Export
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Starter Cards */}
          <div className="pl-0 sm:pl-14 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-zinc-500 tracking-wider">
              <span>Or choose a pre-configured architecture:</span>
              <span className="text-zinc-600 font-mono lowercase">click to load prompt</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickStarters.map((starter) => (
                <button
                  key={starter.title}
                  type="button"
                  onClick={() => handleSelectStarter(starter)}
                  className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/90 hover:border-zinc-500 hover:bg-zinc-800/60 text-left transition group shadow-md flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 group-hover:text-white">
                    {starter.icon}
                    <span>{starter.title}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {starter.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Additional Dynamic Chat Messages */}
          {chatMessages.slice(1).map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-3.5 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Bot className="w-4 h-4 text-zinc-200" />
                </div>
              )}
              <div
                className={`p-4 rounded-2xl max-w-xl text-xs sm:text-sm leading-relaxed shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-white text-black rounded-tr-none font-medium'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none space-y-2'
                }`}
              >
                <div>{msg.text}</div>
                {msg.step && (
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80 text-xs text-zinc-400 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>{msg.step}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Floating Conversational Input Form */}
        <div className="space-y-4 pt-4 sticky bottom-4">
          {error && (
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-zinc-400 hover:text-white text-xs">
                Dismiss
              </button>
            </div>
          )}

          <form
            onSubmit={handleStartGeneration}
            className="rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl p-3.5 sm:p-4 space-y-3 backdrop-blur"
          >
            {/* Optional Application Name */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-zinc-400 shrink-0">App Name:</span>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. PulseMetrics Platform (optional)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            {/* Prompt Textarea */}
            <div className="relative">
              <textarea
                rows={3}
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
                placeholder="What are we building today? Describe your requirements, user roles, pages, data fields, and workflow... (Press Enter to submit)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 resize-none leading-relaxed"
              />
            </div>

            {/* Form Action Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                  Target: Next.js + React 19 + TypeScript
                </span>
                <span className="hidden sm:inline text-zinc-600">
                  • ↵ Enter to send, Shift+↵ for newline
                </span>
              </div>

              <button
                type="submit"
                disabled={!prompt.trim() || isSubmitting}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-lg shadow-white/10 transition flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Synthesizing Codebase...</span>
                  </>
                ) : (
                  <>
                    <span>Generate & Launch Live Preview</span>
                    <Send className="w-3.5 h-3.5 text-black" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Active Projects Quick Access */}
        <div className="pt-8 border-t border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4 text-zinc-300" />
              Active Applications Workspace
            </span>
            <span className="text-zinc-500 font-mono">
              {loadingProjects ? 'Loading...' : `${projects.length} Available`}
            </span>
          </div>

          {loadingProjects ? (
            <div className="p-8 text-center text-zinc-500 space-y-2">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-400" />
              <div className="text-xs font-mono">Loading active applications...</div>
            </div>
          ) : projects.length === 0 ? (
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center text-xs text-zinc-400">
              No active applications yet. Type your idea above to create your first application!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/workspace/${p.id}`)}
                  className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-600 text-left transition group cursor-pointer flex flex-col justify-between shadow-lg"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-950 text-zinc-300 border border-zinc-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {p.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(p.updatedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-zinc-100 group-hover:text-white transition truncate">
                      {p.name}
                    </h4>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-zinc-800/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-zinc-400">
                      <button
                        onClick={(e) => handleExportZip(p.id, p.name, e)}
                        disabled={exportingId === p.id}
                        title="Download Source Code (.zip)"
                        className="p-1 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteProject(p.id, e)}
                        title="Archive Project"
                        className="p-1 rounded-lg hover:bg-zinc-800 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-zinc-300 group-hover:text-white text-xs font-medium group-hover:translate-x-0.5 transition-transform">
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-500 bg-zinc-950/80">
        Shipshape - End to End Application Builder • Conversational AI Workspace
      </footer>
    </div>
  );
}
