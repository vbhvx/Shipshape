'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NewProjectModal from '@/components/workspace/NewProjectModal';
import { Project } from '@/types';
import {
  Sparkles,
  Plus,
  ArrowRight,
  Download,
  Trash2,
  Cpu,
  Server,
  FolderGit2,
  Layout,
  BarChart3,
  ShoppingBag,
  Users,
  Loader2,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleExportZip = async (projectId: string, name: string) => {
    try {
      setExportingId(projectId);
      const res = await fetch(`/api/v1/projects/${projectId}/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.toLowerCase().replace(/\s+/g, '-')}-archive.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingId(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to archive this project?')) return;
    try {
      await fetch(`/api/v1/projects/${projectId}`, { method: 'DELETE' });
      await loadProjects();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCreated = (projectId: string) => {
    setIsModalOpen(false);
    router.push(`/workspace/${projectId}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
              S
            </div>
            <div>
              <span className="font-bold text-zinc-100 tracking-tight text-base">Shipshape</span>
              <span className="text-[10px] text-zinc-500 ml-2 font-mono uppercase bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                AI App Builder MVP
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Application</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-zinc-800 bg-gradient-to-b from-indigo-950/20 via-zinc-950 to-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Next.js + React + TypeScript App Generator & Cloud Sandbox</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight max-w-4xl">
            From Plain Language to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400">Executable, Inspectable</span> Software.
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
            Describe your product requirements. Shipshape plans the architecture, generates a coherent multi-file Next.js codebase, runs the application in an isolated sandbox, provides live preview, and allows iterative refinement with full version diffs and source code export.
          </p>

          {/* Core Feature Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 max-w-4xl">
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-zinc-200">Natural-Language Planning</div>
                <div className="text-[10px] text-zinc-500">Structured specs & editable plan</div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-2.5">
              <FolderGit2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-zinc-200">Multi-File Generator</div>
                <div className="text-[10px] text-zinc-500">Coherent Next.js & TypeScript</div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-2.5">
              <Server className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-zinc-200">Isolated Runtime</div>
                <div className="text-[10px] text-zinc-500">Sandboxed preview & build logs</div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-2.5">
              <Download className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-zinc-200">Zero Lock-In Export</div>
                <div className="text-[10px] text-zinc-500">Download clean .zip archive</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Projects Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-100 tracking-tight">Active Projects</h2>
              <p className="text-xs text-zinc-500">Manage, inspect, and run generated full-stack applications.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition"
            >
              <span>+ Create Project</span>
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-zinc-500 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
              <div className="text-xs font-mono">Loading projects...</div>
            </div>
          ) : projects.length === 0 ? (
            <div className="p-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto text-xl">
                ⚡
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">No applications generated yet</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                  Start by describing an idea or picking a tested template. Shipshape will generate the codebase and start the isolated preview.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
              >
                Create First Application
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 hover:border-zinc-700 transition flex flex-col justify-between group shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {p.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(p.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-zinc-100 group-hover:text-indigo-400 transition">
                      {p.name}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-zinc-400">
                      <button
                        onClick={() => handleExportZip(p.id, p.name)}
                        disabled={exportingId === p.id}
                        title="Download Source Code (.zip)"
                        className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(p.id)}
                        title="Archive Project"
                        className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <Link
                      href={`/workspace/${p.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Starter Templates Section */}
        <section className="space-y-4 pt-6 border-t border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-100 tracking-tight">Tested Next.js Application Blueprints</h2>
            <p className="text-xs text-zinc-500">
              One-click instant generation from verified architectural templates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/80 text-left transition group space-y-2"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center">
                <Layout className="w-4 h-4" />
              </div>
              <div className="font-semibold text-xs text-zinc-200 group-hover:text-indigo-400">
                SaaS Kanban Sprint Board
              </div>
              <p className="text-[11px] text-zinc-500 line-clamp-2">
                Drag-and-drop workflow, task priorities, status metrics, and CSV export.
              </p>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/80 text-left transition group space-y-2"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="font-semibold text-xs text-zinc-200 group-hover:text-indigo-400">
                AI Analytics & Forecasting
              </div>
              <p className="text-[11px] text-zinc-500 line-clamp-2">
                Dynamic KPI metric distribution, historical charts, and trend insights.
              </p>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/80 text-left transition group space-y-2"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="font-semibold text-xs text-zinc-200 group-hover:text-indigo-400">
                Modern E-Commerce Store
              </div>
              <p className="text-[11px] text-zinc-500 line-clamp-2">
                Filterable catalog, shopping cart calculation, inventory, and checkout.
              </p>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/80 text-left transition group space-y-2"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-950 text-amber-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div className="font-semibold text-xs text-zinc-200 group-hover:text-indigo-400">
                Customer Deal CRM
              </div>
              <p className="text-[11px] text-zinc-500 line-clamp-2">
                Pipeline stages, lead contacts, activity tracking, and revenue overview.
              </p>
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-500">
        Shipshape AI Full-Stack Application Builder MVP • Next.js 16 + React 19 + TypeScript + Sandboxed Runtime
      </footer>

      {/* Creation Modal */}
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
