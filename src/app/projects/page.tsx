'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Show, UserButton } from '@clerk/nextjs';
import { Project } from '@/types';
import {
  Sparkles,
  Search,
  ArrowRight,
  Download,
  Trash2,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Copy,
  Pencil,
  Check,
  X,
  Plus,
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

type StatusCategory = 'all' | 'ready' | 'generating' | 'attention' | 'draft';
type SortField = 'updated' | 'created' | 'name';

function getProjectStatusCategory(status: string): 'ready' | 'generating' | 'attention' | 'draft' {
  const s = status.toLowerCase();
  if (s === 'ready' || s === 'running') return 'ready';
  if (s === 'generating' || s === 'planning' || s === 'building') return 'generating';
  if (s === 'error') return 'attention';
  return 'draft';
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusCategory>('all');
  const [sortBy, setSortBy] = useState<SortField>('updated');

  // Action states
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<{ id: string; name: string } | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

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

  const triggerNotice = (msg: string) => {
    setActionSuccessNotice(msg);
    setTimeout(() => setActionSuccessNotice(null), 3000);
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
      triggerNotice(`Exported zip for "${name}"`);
    } catch (err) {
      console.error('Failed to download source:', err);
      alert('Failed to download project source code');
    } finally {
      setExportingId(null);
    }
  };

  const handleDuplicateProject = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      setDuplicatingId(id);
      const res = await fetch(`/api/v1/projects/${id}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.project) {
        setProjects((prev) => [data.project, ...prev]);
        triggerNotice(`Duplicated "${name}" as "${data.project.name}"`);
      } else {
        alert(data.error || 'Failed to duplicate project');
      }
    } catch (err) {
      console.error('Failed to duplicate project:', err);
      alert('Failed to duplicate project');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleStartRename = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingProject({ id: project.id, name: project.name });
    setEditNameValue(project.name);
  };

  const handleSaveRename = async () => {
    if (!editingProject || !editNameValue.trim() || isSavingName) return;
    try {
      setIsSavingName(true);
      const res = await fetch(`/api/v1/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editNameValue.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === editingProject.id ? { ...p, name: editNameValue.trim() } : p
          )
        );
        triggerNotice(`Renamed to "${editNameValue.trim()}"`);
        setEditingProject(null);
      } else {
        alert(data.error || 'Failed to rename project');
      }
    } catch (err) {
      console.error('Failed to rename project:', err);
      alert('Failed to rename project');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        setDeleteConfirmId(null);
        triggerNotice('Project deleted successfully');
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Failed to delete project');
    }
  };

  const filteredAndSortedProjects = useMemo(() => {
    const filtered = projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      const cat = getProjectStatusCategory(p.status);
      return cat === statusFilter;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'created') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // default: updated
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [projects, searchQuery, statusFilter, sortBy]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950/40 text-zinc-100 font-sans selection:bg-zinc-200 selection:text-black bg-grid-crosshair relative">
      {/* Top Notification Toast */}
      {actionSuccessNotice && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-950 text-emerald-300 border border-emerald-800 px-4 py-2.5 rounded-xl text-xs font-medium shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccessNotice}</span>
        </div>
      )}

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
                <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
                  {projects.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/applications"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5 text-black" />
              <span>New Project</span>
            </Link>

            <Show when="signed-in">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'w-8 h-8 rounded-xl border border-zinc-700 shadow-md',
                  },
                }}
              />
            </Show>
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="text-xs font-medium text-zinc-300 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
              >
                Sign in
              </Link>
            </Show>
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
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Manage synthesized applications, fork project baselines, and inspect codebase health.
            </p>
          </div>

          {/* Search, Status Filters & Sort Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'ready', label: 'Ready' },
                  { id: 'generating', label: 'Generating' },
                  { id: 'attention', label: 'Needs Attention' },
                  { id: 'draft', label: 'Draft' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="updated">Last Updated</option>
              <option value="created">Created Date</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Project Cards Grid */}
        {loading ? (
          <div className="p-16 text-center text-zinc-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
            <div className="text-sm font-mono text-zinc-300">Loading projects workspace...</div>
          </div>
        ) : filteredAndSortedProjects.length === 0 ? (
          <div className="p-16 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-zinc-200 border border-zinc-700 flex items-center justify-center mx-auto text-xl font-bold">
              ⚡
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">No projects found</h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'No projects match your search query or status filter.'
                  : 'You have not created any projects yet. Start by describing your application idea.'}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAndSortedProjects.map((p) => {
              const statusCategory = getProjectStatusCategory(p.status);
              const brandChar = (p.name || 'P').trim().charAt(0).toUpperCase();

              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 p-5 space-y-4 transition flex flex-col justify-between group shadow-xl relative"
                >
                  <div className="space-y-3">
                    {/* Status & Relative Time */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {statusCategory === 'ready' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Ready
                          </span>
                        ) : statusCategory === 'generating' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Generating
                          </span>
                        ) : statusCategory === 'attention' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Needs Attention
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-950 text-zinc-400 border border-zinc-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            Draft
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800/80">
                          Next.js App
                        </span>
                      </div>

                      <span className="text-[11px] text-zinc-500 font-mono">
                        {getRelativeTime(p.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white text-xs shrink-0 select-none">
                        {brandChar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 group/title">
                          <h3 className="text-sm sm:text-base font-bold text-zinc-100 group-hover:text-white transition truncate">
                            {p.name}
                          </h3>
                          <button
                            onClick={(e) => handleStartRename(p, e)}
                            className="opacity-0 group-hover/title:opacity-100 p-0.5 rounded text-zinc-400 hover:text-white transition"
                            title="Rename Project"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                          {p.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-zinc-400">
                      {/* Duplicate Project */}
                      <button
                        onClick={(e) => handleDuplicateProject(p.id, p.name, e)}
                        disabled={duplicatingId === p.id}
                        title="Duplicate / Fork Project"
                        className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition cursor-pointer"
                      >
                        {duplicatingId === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Export Zip */}
                      <button
                        onClick={(e) => handleExportZip(p.id, p.name, e)}
                        disabled={exportingId === p.id}
                        title="Download Source Code (.zip)"
                        className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition cursor-pointer"
                      >
                        {exportingId === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Delete Project */}
                      <button
                        onClick={() => setDeleteConfirmId(p.id)}
                        title="Delete Project"
                        className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

                  {/* Inline Delete Confirmation Overlay */}
                  {deleteConfirmId === p.id && (
                    <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur rounded-2xl p-4 flex flex-col justify-center items-center text-center space-y-3 z-20 border border-rose-800/60 animate-in fade-in">
                      <AlertCircle className="w-6 h-6 text-rose-400" />
                      <div>
                        <div className="font-bold text-xs text-white">Delete &ldquo;{p.name}&rdquo;?</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 max-w-xs">
                          This will permanently delete this project and all its generated files.
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
                          Confirm Delete
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

      {/* Rename Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Rename Project</h3>
              <button
                onClick={() => setEditingProject(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Project Name</label>
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setEditingProject(null);
                }}
                autoFocus
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditingProject(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRename}
                disabled={isSavingName || !editNameValue.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
              >
                {isSavingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
