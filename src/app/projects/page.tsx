'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Project } from '@/types';
import {
  Sparkles,
  Search,
  ArrowRight,
  Download,
  Trash2,
  Square,
  Loader2,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'ready' | 'building'>('all');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  const handleStopRuntime = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      setStoppingId(id);
      const res = await fetch(`/api/v1/projects/${id}/runtime/stop`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: 'ready' } : p))
        );
      }
    } catch (err) {
      console.error('Failed to stop runtime:', err);
    } finally {
      setStoppingId(null);
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

  const handleDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Failed to delete project');
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || p.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950/40 text-zinc-100 font-sans selection:bg-zinc-200 selection:text-black bg-grid-crosshair relative">
      {/* Top Navbar */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Landing Page</span>
            </Link>

            <div className="h-4 w-px bg-zinc-800" />

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-950 border border-zinc-700/80 flex items-center justify-center font-black text-white text-base shadow-lg shadow-black/40 select-none">
                S
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-100 tracking-tight text-base">Projects</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/applications"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Start building</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        {/* Header & Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Projects Workspace
            </h1>
            <p className="text-sm text-zinc-300 mt-1">
              Manage your synthesized codebases, monitor running sandboxes, and export source code.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400 transition"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs">
              {(['all', 'running', 'ready', 'building'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition cursor-pointer ${
                    statusFilter === filter
                      ? 'bg-zinc-800 text-white font-semibold shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Project Cards Grid */}
        {loading ? (
          <div className="p-16 text-center text-zinc-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
            <div className="text-sm font-mono text-zinc-300">Loading projects workspace...</div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-16 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-zinc-200 border border-zinc-700 flex items-center justify-center mx-auto text-xl font-bold">
              ⚡
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">No projects found</h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'No projects match your search query or status filter.'
                  : 'You have not created any projects yet. Start by describing your application.'}
              </p>
            </div>
            <Link
              href="/applications"
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-lg shadow-white/10 transition inline-flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Start building project</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((p) => {
              const isRunning = p.status.toLowerCase() === 'running';
              const isBuilding = p.status.toLowerCase() === 'building';

              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 p-5 space-y-4 transition flex flex-col justify-between group shadow-xl relative"
                >
                  <div className="space-y-3">
                    {/* Status & Relative Time */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700/80 shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            RUNNING
                          </span>
                        ) : isBuilding ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            BUILDING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-950 text-zinc-300 border border-zinc-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            READY
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800/80">
                          v1 • Next.js
                        </span>
                      </div>

                      <span className="text-[11px] text-zinc-400 font-mono">
                        {getRelativeTime(p.updatedAt)}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-zinc-100 group-hover:text-white transition">
                      {p.name}
                    </h3>

                    <p className="text-xs sm:text-[13px] text-zinc-300 line-clamp-3 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {isRunning && (
                        <button
                          onClick={(e) => handleStopRuntime(p.id, e)}
                          disabled={stoppingId === p.id}
                          title="Stop sandbox process"
                          className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-rose-400 hover:text-rose-300 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                        >
                          <Square className="w-3 h-3 fill-current" />
                          <span>Stop</span>
                        </button>
                      )}

                      <button
                        onClick={(e) => handleExportZip(p.id, p.name, e)}
                        disabled={exportingId === p.id}
                        title="Download Source Code (.zip)"
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setDeleteConfirmId(p.id)}
                        title="Delete Project"
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <Link
                      href={`/workspace/${p.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-md shadow-white/10 transition flex items-center gap-1.5"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 text-black" />
                    </Link>
                  </div>

                  {/* Inline Delete Confirmation Modal */}
                  {deleteConfirmId === p.id && (
                    <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur rounded-2xl p-4 flex flex-col justify-center items-center text-center space-y-3 z-20 border border-rose-800/60 animate-fadeIn">
                      <AlertCircle className="w-6 h-6 text-rose-400" />
                      <div>
                        <div className="font-bold text-xs text-white">Delete &ldquo;{p.name}&rdquo;?</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          This will remove all synthesized code and sandbox files.
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeleteProject(p.id)}
                          className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition cursor-pointer"
                        >
                          Delete Project
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-8 bg-zinc-950 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">Shipshape - End to End Application Builder</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <Link href="/" className="hover:text-white transition">Landing Page</Link>
            <Link href="/applications" className="hover:text-white transition">Start building</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
