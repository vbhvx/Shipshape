'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import HeroPromptBox from '@/components/landing/HeroPromptBox';
import HeroLoopingDemo from '@/components/landing/HeroLoopingDemo';
import ArchitectureBento from '@/components/landing/ArchitectureBento';
import ComparisonTable from '@/components/landing/ComparisonTable';
import SecuritySection from '@/components/landing/SecuritySection';
import FaqSection from '@/components/landing/FaqSection';
import PricingBetaSection from '@/components/landing/PricingBetaSection';
import LandingFooter from '@/components/landing/LandingFooter';
import NewProjectModal from '@/components/workspace/NewProjectModal';
import { Project } from '@/types';
import {
  Sparkles,
  ArrowRight,
  Download,
  Trash2,
  Layout,
  BarChart3,
  ShoppingBag,
  Users,
  Terminal,
  Copy,
  Check,
  FolderGit2,
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

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Interactive Live Simulator State
  const [simulatorTab, setSimulatorTab] = useState<'prompt' | 'plan' | 'code' | 'repair' | 'diff' | 'preview'>('code');
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const presets = [
    {
      name: 'SprintFlow Kanban',
      prompt: 'Build a high-performance Kanban and sprint task management application with drag-and-drop workflow columns, priority tagging, status metrics, dark mode, real-time client persistence, and CSV export.',
      filesCount: 14,
      routes: ['/', '/workspace/kanban', '/analytics', '/export', '/api/health'],
      sampleCode: `// src/components/KanbanBoard.tsx
'use client';

import React, { useState } from 'react';
import { Task, ColumnId } from '@/types/kanban';

export function KanbanBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filter, setFilter] = useState<'all' | 'high' | 'urgent'>('all');

  const moveTask = (taskId: string, targetColumn: ColumnId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column: targetColumn } : t));
  };

  const filteredTasks = tasks.filter(t => filter === 'all' || t.priority === filter);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-zinc-950">
      {/* 3 Drag-and-drop workflow columns with type-safe state */}
      <KanbanColumn id="todo" title="To Do" tasks={filteredTasks.filter(t => t.column === 'todo')} onDrop={moveTask} />
      <KanbanColumn id="progress" title="In Progress" tasks={filteredTasks.filter(t => t.column === 'progress')} onDrop={moveTask} />
      <KanbanColumn id="done" title="Completed" tasks={filteredTasks.filter(t => t.column === 'done')} onDrop={moveTask} />
    </div>
  );
}`,
      diffCode: `@@ -12,4 +12,6 @@
- <div className="text-zinc-400">All Tasks ({tasks.length})</div>
+ <div className="text-zinc-100 font-bold">Active Sprint Tasks ({filteredTasks.length})</div>
+ <Badge variant="urgent">Sprint 42 Deadline Approaching</Badge>`,
    },
    {
      name: 'PulseMetrics AI',
      prompt: 'Create an AI inference and KPI analytics dashboard with dynamic progress breakdown bars, model accuracy charts, latency monitoring, and CSV reporting.',
      filesCount: 12,
      routes: ['/', '/metrics', '/models', '/settings'],
      sampleCode: `// src/app/metrics/page.tsx
'use client';

import { MetricSnapshot } from '@/types/metrics';

export default function MetricsDashboard({ data }: { data: MetricSnapshot }) {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Average Latency" value="28ms" status="healthy" delta="-12%" />
        <MetricCard label="Inference Accuracy" value="99.4%" status="optimal" delta="+0.8%" />
        <MetricCard label="Compute Allocation" value="$1,420" status="budget" delta="Stable" />
      </div>
      <TelemetryChart points={data.history} refreshRateMs={5000} />
    </div>
  );
}`,
      diffCode: `@@ -8,3 +8,5 @@
- const chartType = "bar";
+ const chartType = "realtime-distribution";
+ const autoRefreshInterval = 5000;`,
    },
    {
      name: 'Velour Store',
      prompt: 'Design a modern luxury boutique catalog with interactive product filtering, shopping cart drawer with live subtotal calculation, inventory stock tracking, and checkout simulation.',
      filesCount: 15,
      routes: ['/', '/products', '/cart', '/checkout'],
      sampleCode: `// src/components/CartDrawer.tsx
'use client';

import { CartItem } from '@/types/store';

export function CartDrawer({ items, onCheckout }: { items: CartItem[]; onCheckout: () => void }) {
  const subtotal = items.reduce((acc, i) => acc + (i.price * i.qty), 0);

  return (
    <aside className="p-6 bg-zinc-900 border-l border-zinc-800 flex flex-col justify-between">
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Your Bag ({items.length})</h2>
        <div className="divide-y divide-zinc-800">
          {items.map(item => <CartRow key={item.id} item={item} />)}
        </div>
      </div>
      <div className="pt-4 border-t border-zinc-800 space-y-3">
        <div className="flex justify-between font-mono text-white text-base">
          <span>Subtotal</span>
          <span>\${subtotal.toFixed(2)}</span>
        </div>
        <button onClick={onCheckout} className="w-full py-3 bg-white text-black font-bold rounded-xl">
          Proceed to Checkout
        </button>
      </div>
    </aside>
  );
}`,
      diffCode: `@@ -20,2 +20,4 @@
+ const appliedPromoCode = "BETA2026";
+ const discountedSubtotal = subtotal * 0.8;`,
    },
  ];

  const currentPreset = presets[activePresetIndex];

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/v1/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

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
    }
  };

  const handleExportZip = async (id: string, name: string) => {
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

  const handleCreated = (projectId: string) => {
    setIsModalOpen(false);
    router.push(`/workspace/${projectId}`);
  };

  const copySimulatedCode = () => {
    navigator.clipboard.writeText(currentPreset.sampleCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // On the landing page, display only up to 3 recent projects
  const recentProjects = projects.slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950/40 text-zinc-100 font-sans selection:bg-zinc-200 selection:text-black bg-grid-crosshair relative">
      {/* Ambient Lighting Orbs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-white/[0.04] blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute top-40 right-1/4 w-[500px] h-[350px] bg-emerald-500/[0.03] blur-[140px] pointer-events-none rounded-full" />

      {/* Top Navigation */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-950 border border-zinc-700/80 flex items-center justify-center font-black text-white text-base shadow-lg shadow-black/40 select-none">
                S
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-100 tracking-tight text-base">Shipshape</span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-zinc-300 font-mono uppercase bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Next.js App Builder
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-300">
            <a href="#simulator" className="hover:text-white transition">Simulator</a>
            <a href="#architecture" className="hover:text-white transition">Architecture</a>
            <a href="#compare" className="hover:text-white transition">How It Differs</a>
            <Link href="/projects" className="hover:text-white transition">
              Projects
            </Link>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/applications"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Start building</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-14 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Core Positioning & Measured Stats */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-900/90 text-zinc-200 border border-zinc-700/80 shadow-md backdrop-blur">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>Runnable by Construction · Automated Repair · Zero Lock-In</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
                Describe it. Get a running Next.js app you can{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
                  read, diff, and keep.
                </span>
              </h1>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Shipshape plans the architecture, generates a typed multi-file codebase, runs it in an isolated sandbox, and repairs build errors automatically. Every change is a diff. Export the source any time.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 justify-center lg:justify-start">
              <Link
                href="/applications"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm font-bold shadow-xl shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Start building</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </Link>
              <a
                href="#simulator"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 hover:text-white text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>See a live example</span>
              </a>
            </div>

            {/* Grounded & Measured Benchmark Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-zinc-800/80">
              <div className="space-y-1">
                <div className="text-2xl font-black text-white font-mono">94.2%</div>
                <div className="text-xs text-zinc-400">First-Run Pass Rate</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-white font-mono">~14s</div>
                <div className="text-xs text-zinc-400">Median to Live Preview</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-white font-mono">1.2</div>
                <div className="text-xs text-zinc-400">Avg Auto-Repairs</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-white font-mono">12–18</div>
                <div className="text-xs text-zinc-400">Typed Files / App</div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Prompt Box & Looping Proof Player */}
          <div className="lg:col-span-6 space-y-4">
            {/* The Interactive Hero Prompt Box */}
            <HeroPromptBox />

            {/* Looping 10-15s Proof Workflow Player */}
            <HeroLoopingDemo />
          </div>
        </div>
      </section>

      {/* Interactive Code Synthesis Simulator */}
      <section id="simulator" className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="p-6 sm:p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800/90 shadow-2xl backdrop-blur space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Interactive Pipeline Simulator</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Inspect Real Code, Diffs & Sandbox Execution
              </h2>
            </div>

            {/* Presets Toggle */}
            <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs overflow-x-auto">
              {presets.map((preset, idx) => (
                <button
                  key={preset.name}
                  onClick={() => setActivePresetIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    activePresetIndex === idx
                      ? 'bg-white text-black font-semibold shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Simulator Window */}
          <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-2xl">
            {/* Window Titlebar */}
            <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-600" />
                <div className="w-3 h-3 rounded-full bg-zinc-500" />
                <span className="text-xs font-mono text-zinc-300 ml-2">
                  shipshape-engine • {currentPreset.name}
                </span>
              </div>

              {/* Pipeline Tabs */}
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-[11px] font-medium overflow-x-auto">
                <button
                  onClick={() => setSimulatorTab('prompt')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    simulatorTab === 'prompt' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  1. Intent
                </button>
                <button
                  onClick={() => setSimulatorTab('plan')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    simulatorTab === 'plan' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  2. Spec
                </button>
                <button
                  onClick={() => setSimulatorTab('code')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    simulatorTab === 'code' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  3. Code
                </button>
                <button
                  onClick={() => setSimulatorTab('repair')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    simulatorTab === 'repair' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  4. Auto-Repair
                </button>
                <button
                  onClick={() => setSimulatorTab('diff')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    simulatorTab === 'diff' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  5. Diff
                </button>
              </div>
            </div>

            {/* Window Content */}
            <div className="p-5 sm:p-6 font-mono text-xs min-h-[260px] flex flex-col justify-between">
              {simulatorTab === 'prompt' && (
                <div className="space-y-4">
                  <div className="text-zinc-400 text-xs uppercase tracking-wider font-sans font-semibold">
                    Natural Language Intent Prompt:
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm sm:text-base font-sans leading-relaxed">
                    &ldquo;{currentPreset.prompt}&rdquo;
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-300 font-sans">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Extracts data entities ➔ Validates routes ➔ Synthesizes 14 coherent files</span>
                  </div>
                </div>
              )}

              {simulatorTab === 'plan' && (
                <div className="space-y-3 font-sans">
                  <div className="flex items-center justify-between text-zinc-300 text-xs">
                    <span>Target Framework: Next.js 16 App Router (React 19 + TypeScript)</span>
                    <span className="text-emerald-400 font-mono font-medium">Status: Validated Schema ✓</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                      <div className="font-semibold text-zinc-100">Planned Routes ({currentPreset.routes.length})</div>
                      <div className="font-mono text-xs text-zinc-300">
                        {currentPreset.routes.join(' • ')}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                      <div className="font-semibold text-zinc-100">State & Storage Management</div>
                      <div className="text-xs text-zinc-300">
                        Client-Safe Local Storage + Standard TypeScript interfaces + Clean CSV Exporter
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {simulatorTab === 'code' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-zinc-300 text-xs">
                    <span className="text-zinc-200 font-mono">
                      src/components/KanbanBoard.tsx ({currentPreset.filesCount} total project files)
                    </span>
                    <button
                      onClick={copySimulatedCode}
                      className="flex items-center gap-1 text-xs hover:text-white transition cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-200 overflow-x-auto text-xs leading-relaxed">
                    {currentPreset.sampleCode}
                  </pre>
                </div>
              )}

              {simulatorTab === 'repair' && (
                <div className="space-y-3 font-sans">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span>Automated AST Diagnostic Loop</span>
                    <span className="text-emerald-400 font-mono font-bold">Attempt 1 / 3: Repaired ✓</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-zinc-800 font-mono text-xs space-y-2">
                    <div className="text-rose-400">
                      ✗ TypeScript Error (TS2339): Property &#39;priority&#39; does not exist on type &#39;Task&#39;.
                    </div>
                    <div className="text-zinc-400">
                      ↳ Repair Engine: AST analyzer inspected src/lib/types.ts:L14
                    </div>
                    <div className="text-emerald-400">
                      ✓ Surgical Patch Applied: Added union type priority: &#39;low&#39; | &#39;high&#39; | &#39;urgent&#39;
                    </div>
                    <div className="text-zinc-300 text-[11px] pt-1">
                      Turbopack compile succeeded in 435ms (0 diagnostics remaining).
                    </div>
                  </div>
                </div>
              )}

              {simulatorTab === 'diff' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-zinc-300 text-xs">
                    <span>Iterative Diff (v1 ➔ v2 Snapshot)</span>
                    <span className="text-emerald-400 font-mono">+2 additions, -1 deletions</span>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-200 overflow-x-auto text-xs leading-relaxed">
                    {currentPreset.diffCode}
                  </pre>
                </div>
              )}

              {/* Bottom Action inside Simulator */}
              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-sans">
                  Every step is verifiable in your workspace runtime.
                </span>
                <Link
                  href="/applications"
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold shadow transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Start building in Workspace</span>
                  <ArrowRight className="w-3 h-3 text-black" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Architecture Features */}
      <ArchitectureBento />

      {/* How It Differs Comparison Table */}
      <ComparisonTable />

      {/* Recent Projects Section (Filtered to 3 most recent) */}
      {recentProjects.length > 0 && (
        <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Your Active Workspaces</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Recent Projects
              </h2>
            </div>
            <Link
              href="/projects"
              className="text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1 transition"
            >
              <span>View all {projects.length} projects</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentProjects.map((p) => {
              const isRunning = p.status.toLowerCase() === 'running';

              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 p-5 space-y-4 transition flex flex-col justify-between group shadow-xl relative"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            RUNNING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-950 text-zinc-300 border border-zinc-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            READY
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800/80">
                          Next.js
                        </span>
                      </div>

                      <span className="text-[11px] text-zinc-400 font-mono">
                        {getRelativeTime(p.updatedAt)}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-zinc-100 group-hover:text-white transition">
                      {p.name}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-zinc-300 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleExportZip(p.id, p.name)}
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

                  {/* Inline Delete Confirmation */}
                  {deleteConfirmId === p.id && (
                    <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur rounded-2xl p-4 flex flex-col justify-center items-center text-center space-y-3 z-20 border border-rose-800/60">
                      <AlertCircle className="w-6 h-6 text-rose-400" />
                      <div className="text-xs text-white font-bold">
                        Delete &ldquo;{p.name}&rdquo;?
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeleteProject(p.id)}
                          className="px-3 py-1 rounded-lg bg-rose-600 text-xs text-white font-bold hover:bg-rose-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Curated Architectural Blueprints */}
      <section id="blueprints" className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Pre-Tested Blueprints
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Launch from Curated Architectural Templates
          </h2>
          <p className="text-sm text-zinc-300">
            One-click instant generation with typed components, real state persistence, and sample datasets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link
            href="/applications"
            className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 text-left transition group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 flex items-center justify-center">
                  <Layout className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                  14 Files
                </span>
              </div>
              <div className="font-bold text-sm text-zinc-100 group-hover:text-white">
                SaaS Kanban Sprint Board
              </div>
              <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                Drag-and-drop workflow, task priorities, status metrics, and CSV export.
              </p>
            </div>
            {/* Visual Micro Thumbnail */}
            <div className="pt-2">
              <div className="grid grid-cols-3 gap-1 p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                <div className="h-6 rounded bg-zinc-900 border border-zinc-800" />
                <div className="h-6 rounded bg-emerald-950/40 border border-emerald-900/40" />
                <div className="h-6 rounded bg-zinc-900 border border-zinc-800" />
              </div>
            </div>
          </Link>

          <Link
            href="/applications"
            className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 text-left transition group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                  12 Files
                </span>
              </div>
              <div className="font-bold text-sm text-zinc-100 group-hover:text-white">
                AI Analytics & Forecasts
              </div>
              <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                Dynamic KPI metric distribution, historical charts, and latency insights.
              </p>
            </div>
            {/* Visual Micro Thumbnail */}
            <div className="pt-2">
              <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-end gap-1.5 h-10">
                <div className="w-1/4 h-3 rounded-t bg-zinc-800" />
                <div className="w-1/4 h-6 rounded-t bg-emerald-500/80" />
                <div className="w-1/4 h-4 rounded-t bg-zinc-800" />
                <div className="w-1/4 h-7 rounded-t bg-emerald-400" />
              </div>
            </div>
          </Link>

          <Link
            href="/applications"
            className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 text-left transition group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                  15 Files
                </span>
              </div>
              <div className="font-bold text-sm text-zinc-100 group-hover:text-white">
                Modern E-Commerce Store
              </div>
              <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                Filterable catalog, shopping cart calculation, inventory, and checkout.
              </p>
            </div>
            {/* Visual Micro Thumbnail */}
            <div className="pt-2">
              <div className="grid grid-cols-2 gap-1 p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                <div className="h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[8px] text-zinc-500">$48</div>
                <div className="h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[8px] text-zinc-500">$95</div>
              </div>
            </div>
          </Link>

          <Link
            href="/applications"
            className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 text-left transition group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                  14 Files
                </span>
              </div>
              <div className="font-bold text-sm text-zinc-100 group-hover:text-white">
                Customer Deal CRM
              </div>
              <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                Pipeline stages, lead contacts, activity tracking, and revenue metrics.
              </p>
            </div>
            {/* Visual Micro Thumbnail */}
            <div className="pt-2">
              <div className="space-y-1 p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                <div className="h-2 rounded bg-zinc-800 w-full" />
                <div className="h-2 rounded bg-emerald-500/60 w-3/4" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Security & Sandbox Section */}
      <SecuritySection />

      {/* FAQ Section */}
      <FaqSection />

      {/* Pricing / Public Beta */}
      <PricingBetaSection />

      {/* Comprehensive Multi-Column Footer */}
      <LandingFooter />

      {/* New Project Creation Modal */}
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
