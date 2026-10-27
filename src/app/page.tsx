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
  Terminal,
  Eye,
  RotateCw,
  GitBranch,
  Copy,
  Check,
  MessageSquare,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Interactive Live Simulator State
  const [simulatorTab, setSimulatorTab] = useState<'prompt' | 'plan' | 'code' | 'preview' | 'diff'>('prompt');
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const presets = [
    {
      name: 'TaskFlow Pro (Kanban)',
      prompt: 'Build a high-performance Kanban and sprint task management application with drag-and-drop workflow columns, priority tagging, status metrics, dark mode, real-time client persistence, and CSV export.',
      filesCount: 14,
      routes: ['/', '/explore', '/analytics', '/settings', '/api/health'],
      sampleCode: `// src/app/explore/page.tsx
export default function ExplorePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState('all');

  const filtered = items.filter(i => filter === 'all' || i.status === filter);

  return (
    <div className="p-6 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Data Explorer</h1>
        <button onClick={() => exportToCSV(filtered)} className="btn-brand">
          Export CSV
        </button>
      </div>
      <DataTable items={filtered} />
    </div>
  );
}`,
      diffCode: `@@ -12,4 +12,6 @@
- <div className="text-zinc-400">All Items</div>
+ <div className="text-zinc-200 font-bold">Filtered Active Items</div>
+ <span className="badge-urgent">High Priority Only</span>`,
    },
    {
      name: 'PulseMetrics (AI Analytics)',
      prompt: 'Create an AI inference and KPI analytics dashboard with dynamic progress breakdown bars, model accuracy charts, latency monitoring, and CSV reporting.',
      filesCount: 12,
      routes: ['/', '/metrics', '/models', '/settings'],
      sampleCode: `// src/app/analytics/page.tsx
export default function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<MetricSnapshot>();

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card title="Average Latency" value="28ms" status="healthy" />
      <Card title="Inference Accuracy" value="99.4%" status="optimal" />
      <Card title="Compute Allocation" value="$1,420" status="budget" />
    </div>
  );
}`,
      diffCode: `@@ -8,3 +8,5 @@
- const chartType = "bar";
+ const chartType = "realtime-distribution";
+ const autoRefreshInterval = 5000;`,
    },
    {
      name: 'Velour Store (E-Commerce)',
      prompt: 'Design a modern luxury boutique catalog with interactive product filtering, shopping cart drawer with live subtotal calculation, inventory stock tracking, and checkout simulation.',
      filesCount: 15,
      routes: ['/', '/products', '/cart', '/checkout'],
      sampleCode: `// src/components/CartDrawer.tsx
export function CartDrawer({ items, onCheckout }: CartProps) {
  const subtotal = items.reduce((acc, i) => acc + (i.price * i.qty), 0);

  return (
    <div className="p-4 bg-zinc-900 border-l border-zinc-800">
      <h2 className="text-lg font-bold">Your Bag ({items.length})</h2>
      <div className="font-mono text-zinc-200">\${subtotal.toFixed(2)}</div>
      <button onClick={onCheckout} className="w-full btn-checkout">Proceed to Checkout</button>
    </div>
  );
}`,
      diffCode: `@@ -20,2 +20,4 @@
+ const appliedPromoCode = "LAUNCH20";
+ const discountedSubtotal = subtotal * 0.8;`,
    },
  ];

  const currentPreset = presets[activePresetIndex];

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

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
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

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950/80 text-zinc-100 font-sans selection:bg-zinc-200 selection:text-black bg-grid-crosshair relative">
      {/* Ambient Lighting Orbs - Monochrome Silver & White */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-white/[0.04] blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute top-40 right-1/4 w-[500px] h-[350px] bg-zinc-500/[0.04] blur-[140px] pointer-events-none rounded-full" />

      {/* Top Navigation */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-white via-zinc-200 to-zinc-400 flex items-center justify-center font-bold text-black shadow-lg shadow-white/10">
              S
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-100 tracking-tight text-base">Shipshape</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-zinc-300 font-mono uppercase bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Next.js App Builder
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
            <a href="#simulator" className="hover:text-zinc-100 transition">Interactive Simulator</a>
            <a href="#features" className="hover:text-zinc-100 transition">Architecture</a>
            <Link
              href="/applications"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-200 hover:text-white transition font-medium"
            >
              <MessageSquare className="w-3.5 h-3.5 text-zinc-300" />
              <span>Applications</span>
              <span className="text-[10px] font-mono text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded-full border border-zinc-700">Chat</span>
            </Link>
            <a href="#blueprints" className="hover:text-zinc-100 transition">Blueprints</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/applications"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5 text-black" />
              <span>Create Application</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-900/90 text-zinc-300 border border-zinc-700/60 shadow-md backdrop-blur">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300 animate-pulse" />
            <span className="font-semibold text-zinc-200">Autonomous Code Generation · Sandboxes · Live Preview</span>
          </div>

          <div className="space-y-4 max-w-4xl">
            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1]">
              From Plain Language to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
                Executable, Inspectable
              </span>{' '}
              Next.js Software.
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
              Describe an idea in English. Shipshape plans the architecture, generates a coherent multi-file Next.js + React + TypeScript codebase, runs it in an isolated sandbox with live preview, and allows surgical iterative modifications with version diffs and downloadable source code.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <Link
              href="/applications"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm font-semibold shadow-xl shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-black" />
              <span>Start Building Application</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </Link>
            <a
              href="#projects"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800/90 text-zinc-300 hover:text-white text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 text-zinc-400" />
              <span>Explore Live Showcase</span>
            </a>
          </div>

          {/* Metrics Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 max-w-4xl border-t border-zinc-800/80">
            <div className="space-y-1">
              <div className="text-xl sm:text-2xl font-black text-white font-mono">100%</div>
              <div className="text-xs text-zinc-500">TypeScript Type-Safe</div>
            </div>
            <div className="space-y-1">
              <div className="text-xl sm:text-2xl font-black text-zinc-200 font-mono">&lt; 500ms</div>
              <div className="text-xs text-zinc-500">Turbopack Fast Builds</div>
            </div>
            <div className="space-y-1">
              <div className="text-xl sm:text-2xl font-black text-zinc-200 font-mono">Isolated</div>
              <div className="text-xs text-zinc-500">Port & Sandbox Runtime</div>
            </div>
            <div className="space-y-1">
              <div className="text-xl sm:text-2xl font-black text-zinc-200 font-mono">Zero</div>
              <div className="text-xs text-zinc-500">Platform Lock-In (.zip)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Code Synthesis Simulator */}
      <section id="simulator" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="p-6 sm:p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800/90 shadow-2xl backdrop-blur space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                <Terminal className="w-3.5 h-3.5 text-zinc-300" />
                <span>Interactive Live Pipeline Simulator</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Inspect How Shipshape Generates Coherent Code
              </h2>
            </div>

            {/* Presets Toggle */}
            <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs overflow-x-auto">
              {presets.map((preset, idx) => (
                <button
                  key={preset.name}
                  onClick={() => setActivePresetIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
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
            <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/70 flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-600" />
                <div className="w-3 h-3 rounded-full bg-zinc-500" />
                <span className="text-xs font-mono text-zinc-400 ml-2">shipshape-engine v2.0 • {currentPreset.name}</span>
              </div>

              {/* Pipeline Tabs */}
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-[11px] font-medium">
                <button
                  onClick={() => setSimulatorTab('prompt')}
                  className={`px-2.5 py-1 rounded transition ${
                    simulatorTab === 'prompt' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  1. Intent Prompt
                </button>
                <button
                  onClick={() => setSimulatorTab('plan')}
                  className={`px-2.5 py-1 rounded transition ${
                    simulatorTab === 'plan' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  2. Structured Spec
                </button>
                <button
                  onClick={() => setSimulatorTab('code')}
                  className={`px-2.5 py-1 rounded transition ${
                    simulatorTab === 'code' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  3. Generated Code
                </button>
                <button
                  onClick={() => setSimulatorTab('diff')}
                  className={`px-2.5 py-1 rounded transition ${
                    simulatorTab === 'diff' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  4. Version Diff
                </button>
              </div>
            </div>

            {/* Window Content */}
            <div className="p-6 font-mono text-xs min-h-[260px] flex flex-col justify-between">
              {simulatorTab === 'prompt' && (
                <div className="space-y-4">
                  <div className="text-zinc-500 text-[11px] uppercase tracking-wider font-sans font-semibold">
                    Natural Language Product Description:
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-sans leading-relaxed">
                    &ldquo;{currentPreset.prompt}&rdquo;
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-sans">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>Interprets requirements ➔ Extracts data entities & routes ➔ Builds coherent manifest</span>
                  </div>
                </div>
              )}

              {simulatorTab === 'plan' && (
                <div className="space-y-3 font-sans">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Target Framework: Next.js 14+ App Router</span>
                    <span className="text-zinc-200 font-mono font-medium">Status: Plan Validated</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                      <div className="font-semibold text-zinc-200">Planned Routes ({currentPreset.routes.length})</div>
                      <div className="font-mono text-[11px] text-zinc-300">
                        {currentPreset.routes.join(' • ')}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                      <div className="font-semibold text-zinc-200">Persistence Architecture</div>
                      <div className="text-[11px] text-zinc-400">
                        Client-Safe Local Storage + Mock REST API + CSV Exporter
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {simulatorTab === 'code' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span className="text-zinc-300 font-mono">src/app/explore/page.tsx ({currentPreset.filesCount} total project files)</span>
                    <button
                      onClick={copySimulatedCode}
                      className="flex items-center gap-1 text-[11px] hover:text-white transition"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-200 overflow-x-auto text-[11px] leading-relaxed">
                    {currentPreset.sampleCode}
                  </pre>
                </div>
              )}

              {simulatorTab === 'diff' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-zinc-400 text-xs">
                    <span>Targeted Patch: Iterative Edit (v1 ➔ v2)</span>
                    <span className="text-zinc-200 font-mono">+2 additions, -1 deletions</span>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-200 overflow-x-auto text-[11px] leading-relaxed">
                    {currentPreset.diffCode}
                  </pre>
                </div>
              )}

              {/* Bottom Action inside Simulator */}
              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 font-sans">
                  Ready to test with your own requirements?
                </span>
                <Link
                  href="/applications"
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow transition flex items-center gap-1.5"
                >
                  <span>Launch in Workspace</span>
                  <ArrowRight className="w-3 h-3 text-black" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Architecture Features */}
      <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Engineered for Precision
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            How Shipshape Guarantees Runnable Software
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Unlike raw LLMs that output hallucinations, Shipshape binds generation directly to real execution sandboxes, typed schemas, and bounded agent repair.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition space-y-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center font-bold">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-bold text-white">Natural-Language Planning</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Extracts target users, data entities, routes, and acceptance criteria into an editable plan before writing a single line of code.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition space-y-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center font-bold">
              <FolderGit2 className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-bold text-white">Multi-File Next.js Synthesis</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Generates package manifests, App Router layouts, interactive UI components, and TypeScript storage managers with cross-file consistency.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition space-y-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center font-bold">
              <Server className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-bold text-white">Isolated Sandbox Runtime</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Executes generated code in dedicated workspace directories with safe port allocation, process timeouts, and real-time build streaming.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition space-y-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center font-bold">
              <RotateCw className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-bold text-white">Bounded Agent Repair Loop</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Automatically diagnoses TypeScript and syntax errors, generating surgical targeted patches. Capped strictly at 3 attempts to prevent cost runaway.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition space-y-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center font-bold">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-bold text-white">Structured Version Diffs</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Every iterative change creates an immutable version snapshot with line-by-line additions and deletions, plus one-click rollback.
            </p>
          </div>

          {/* Card 6 */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition space-y-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center font-bold">
              <Download className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-bold text-white">Zero Lock-In Source Export</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Download clean `.zip` archives with scrubbed secrets, clean `.env.example`, and developer README ready for `npm run dev` and `npm run build`.
            </p>
          </div>
        </div>
      </section>

      {/* Active Projects Showcase */}
      <section id="projects" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Active Projects Workspace</h2>
            <p className="text-xs text-zinc-400">Launch into the deep-linkable IDE, inspect live previews, and export code.</p>
          </div>
          <Link
            href="/applications"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-lg shadow-white/10 transition self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5 text-black" />
            <span>New Application</span>
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" />
            <div className="text-xs font-mono">Loading projects...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-zinc-200 border border-zinc-700 flex items-center justify-center mx-auto text-xl font-bold">
              ⚡
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">No applications generated yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                Start by describing an idea or picking a tested template. Shipshape will generate the codebase and start the isolated preview.
              </p>
            </div>
            <Link
              href="/applications"
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-lg shadow-white/10 transition inline-block"
            >
              Create First Application
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl bg-zinc-900/90 border border-zinc-800/90 p-5 space-y-4 hover:border-zinc-600 transition-all flex flex-col justify-between group shadow-xl"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-950 text-zinc-300 border border-zinc-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {p.status.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(p.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-zinc-100 group-hover:text-white transition">
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
                    className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-md shadow-white/10 transition flex items-center gap-1.5"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5 text-black" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Blueprint Launchers */}
      <section id="blueprints" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Pre-Tested Blueprints
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Launch from Curated Architectural Templates
          </h2>
          <p className="text-xs text-zinc-500">
            One-click instant generation with typed components, real state persistence, and sample datasets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/applications"
            className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 text-left transition group space-y-3"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center">
              <Layout className="w-4 h-4 text-white" />
            </div>
            <div className="font-semibold text-xs text-zinc-100 group-hover:text-white">
              SaaS Kanban Sprint Board
            </div>
            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
              Drag-and-drop workflow, task priorities, status metrics, and CSV export.
            </p>
          </Link>

          <Link
            href="/applications"
            className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 text-left transition group space-y-3"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div className="font-semibold text-xs text-zinc-100 group-hover:text-white">
              AI Analytics & Forecasts
            </div>
            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
              Dynamic KPI metric distribution, historical charts, and trend insights.
            </p>
          </Link>

          <Link
            href="/applications"
            className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 text-left transition group space-y-3"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div className="font-semibold text-xs text-zinc-100 group-hover:text-white">
              Modern E-Commerce Store
            </div>
            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
              Filterable catalog, shopping cart calculation, inventory, and checkout.
            </p>
          </Link>

          <Link
            href="/applications"
            className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 text-left transition group space-y-3"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div className="font-semibold text-xs text-zinc-100 group-hover:text-white">
              Customer Deal CRM
            </div>
            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
              Pipeline stages, lead contacts, activity tracking, and revenue overview.
            </p>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-8 bg-zinc-950/80 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-200">Shipshape - End to End Application Builder</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <a href="#simulator" className="hover:text-white transition">Simulator</a>
            <a href="#features" className="hover:text-white transition">Architecture</a>
            <a href="#projects" className="hover:text-white transition">Workspace</a>
          </div>
        </div>
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
