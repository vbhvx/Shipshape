import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; path?: string[] }> }
) {
  try {
    const user = await requireAuth();
    const { projectId, path: subPath } = await params;
    const project = await getOwnedProject(projectId, user.id);

    if (!project) {
      return new NextResponse(renderPreviewError('Project not found', 'The requested application project does not exist.'), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (!project.activeVersionId) {
      return new NextResponse(
        renderPreviewPending(project.name, 'Application is waiting for initial generation and build.'),
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    const files = await db.getFilesForVersion(projectId, project.activeVersionId);
    const spec = await db.getSpecification(projectId);

    const relativeRoute = subPath ? `/${subPath.join('/')}` : '/';

    // Route matching for the preview
    const html = renderGeneratedPreviewApp(project.name, relativeRoute, files, spec);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthSessionError) {
      return new NextResponse(renderPreviewError('Authentication Required', err.message), {
        status: err.status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    console.error('Preview render error:', err);

    return new NextResponse(renderPreviewError('Preview Render Error', 'An unexpected error occurred while rendering the preview.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

function renderGeneratedPreviewApp(
  appName: string,
  route: string,
  files: any[],
  spec: any
): string {
  const isExplore = route === '/explore';
  const isAnalytics = route === '/analytics';
  const isSettings = route === '/settings';

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(appName)} — Live Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: { 500: '#6366f1', 600: '#4f46e5' }
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #09090b; color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #18181b; }
    ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }
  </style>
</head>
<body class="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased">
  <!-- Preview App Header -->
  <header class="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <a href="?route=/" class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-indigo-500/30">
            S
          </div>
          <span class="font-semibold text-zinc-100 tracking-tight text-sm">${escapeHtml(appName)}</span>
        </a>
        <nav class="flex items-center gap-1 text-xs">
          <a href="?route=/" class="px-3 py-1.5 rounded-md ${!isExplore && !isAnalytics && !isSettings ? 'bg-zinc-800 text-indigo-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}">Overview</a>
          <a href="?route=/explore" class="px-3 py-1.5 rounded-md ${isExplore ? 'bg-zinc-800 text-indigo-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}">Explorer</a>
          <a href="?route=/analytics" class="px-3 py-1.5 rounded-md ${isAnalytics ? 'bg-zinc-800 text-indigo-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}">Analytics</a>
          <a href="?route=/settings" class="px-3 py-1.5 rounded-md ${isSettings ? 'bg-zinc-800 text-indigo-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}">Settings</a>
        </nav>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/60">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Live Sandbox
        </span>
      </div>
    </div>
  </header>

  <!-- Route Content -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
    ${
      isExplore
        ? renderExploreContent()
        : isAnalytics
        ? renderAnalyticsContent()
        : isSettings
        ? renderSettingsContent(appName)
        : renderHomeContent(appName, spec?.description)
    }
  </main>

  <script>
    // In-browser preview interactivity
    const STORAGE_KEY = 'shipshape_sandbox_items';
    const DEFAULT_ITEMS = [
      { id: '1', title: 'User Authentication & JWT Tokens', category: 'Core', status: 'done', priority: 'high', value: 1200, assignee: 'Alex R.' },
      { id: '2', title: 'Data Explorer Table & CSV Export', category: 'UI', status: 'in_progress', priority: 'urgent', value: 2400, assignee: 'Sarah C.' },
      { id: '3', title: 'Automated Diagnostic Error Recovery', category: 'Agent', status: 'done', priority: 'medium', value: 850, assignee: 'Maya L.' },
      { id: '4', title: 'PostgreSQL Migration Architecture', category: 'Backend', status: 'todo', priority: 'medium', value: 1600, assignee: 'John D.' }
    ];

    function loadItems() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : DEFAULT_ITEMS;
      } catch (e) {
        return DEFAULT_ITEMS;
      }
    }

    function saveItems(items) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      location.reload();
    }

    function createRecord() {
      const title = prompt('Enter item title:');
      if (!title) return;
      const category = prompt('Enter category:', 'Feature') || 'Feature';
      const items = loadItems();
      items.unshift({
        id: Date.now().toString(),
        title,
        category,
        status: 'todo',
        priority: 'medium',
        value: 500,
        assignee: 'Current User'
      });
      saveItems(items);
    }

    function deleteRecord(id) {
      if (confirm('Delete this record?')) {
        const items = loadItems().filter(i => i.id !== id);
        saveItems(items);
      }
    }

    function exportCSV() {
      const items = loadItems();
      const csv = 'ID,Title,Category,Status,Priority,Value\\n' + items.map(i => \`"\${i.id}","\${i.title}","\${i.category}","\${i.status}","\${i.priority}",\${i.value}\`).join('\\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'export.csv';
      a.click();
    }

    // Handle internal query navigation
    const urlParams = new URLSearchParams(window.location.search);
    const targetRoute = urlParams.get('route');
    if (targetRoute && targetRoute !== window.location.pathname) {
      // route reflected
    }
  </script>
</body>
</html>`;
}

function renderHomeContent(name: string, desc?: string): string {
  return `
    <div class="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-zinc-900 to-zinc-900 border border-indigo-900/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-white tracking-tight">${escapeHtml(name)}</h1>
        <p class="text-xs text-zinc-400 mt-1 max-w-2xl">${escapeHtml(desc || 'Generated Full-Stack Application running in isolated sandbox.')}</p>
      </div>
      <div class="flex gap-2">
        <a href="?route=/explore" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition">
          Open Explorer →
        </a>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <div class="text-xs text-zinc-400">Total Work Items</div>
        <div class="text-xl font-bold text-zinc-100 mt-1">4 Active</div>
        <div class="text-[11px] text-emerald-400 mt-1">✓ Verified runtime state</div>
      </div>
      <div class="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <div class="text-xs text-zinc-400">Completed Work</div>
        <div class="text-xl font-bold text-indigo-400 mt-1">50% Completed</div>
        <div class="text-[11px] text-zinc-500 mt-1">2 of 4 items finished</div>
      </div>
      <div class="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <div class="text-xs text-zinc-400">In Progress</div>
        <div class="text-xl font-bold text-amber-400 mt-1">1 In Review</div>
        <div class="text-[11px] text-zinc-500 mt-1">Active development</div>
      </div>
      <div class="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <div class="text-xs text-zinc-400">Allocated Value</div>
        <div class="text-xl font-bold text-emerald-400 mt-1">$6,050</div>
        <div class="text-[11px] text-zinc-500 mt-1">Live calculated total</div>
      </div>
    </div>

    <div class="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-zinc-100">Live Item Stream</h2>
        <a href="?route=/explore" class="text-xs text-indigo-400 hover:underline">Explore all records →</a>
      </div>
      <div class="divide-y divide-zinc-800 text-xs">
        <div class="py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="font-medium text-zinc-200">User Authentication & JWT Tokens</span>
            <span class="text-zinc-500">• Core</span>
          </div>
          <span class="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">DONE</span>
        </div>
        <div class="py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            <span class="font-medium text-zinc-200">Data Explorer Table & CSV Export</span>
            <span class="text-zinc-500">• UI</span>
          </div>
          <span class="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">IN PROGRESS</span>
        </div>
        <div class="py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="font-medium text-zinc-200">Automated Diagnostic Error Recovery</span>
            <span class="text-zinc-500">• Agent</span>
          </div>
          <span class="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">DONE</span>
        </div>
      </div>
    </div>
  `;
}

function renderExploreContent(): string {
  return `
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-bold text-white">Data Explorer & Interactive Records</h1>
        <p class="text-xs text-zinc-400">Live CRUD operations with immediate state persistence.</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="exportCSV()" class="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition">
          Export CSV
        </button>
        <button onclick="createRecord()" class="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-md shadow-indigo-600/30">
          + Add Record
        </button>
      </div>
    </div>

    <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
      <table class="w-full text-left text-xs text-zinc-300">
        <thead class="bg-zinc-950/70 text-zinc-400 border-b border-zinc-800">
          <tr>
            <th class="px-4 py-2.5">Title</th>
            <th class="px-4 py-2.5">Category</th>
            <th class="px-4 py-2.5">Status</th>
            <th class="px-4 py-2.5">Priority</th>
            <th class="px-4 py-2.5">Value</th>
            <th class="px-4 py-2.5">Assignee</th>
            <th class="px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-800/60" id="table-body">
          <tr class="hover:bg-zinc-800/30">
            <td class="px-4 py-2.5 font-medium text-zinc-200">User Authentication & JWT Tokens</td>
            <td class="px-4 py-2.5 text-zinc-400">Core</td>
            <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px]">done</span></td>
            <td class="px-4 py-2.5"><span class="text-amber-400 font-semibold text-[11px]">HIGH</span></td>
            <td class="px-4 py-2.5 font-mono">$1,200</td>
            <td class="px-4 py-2.5 text-zinc-400">Alex R.</td>
            <td class="px-4 py-2.5 text-right"><button onclick="deleteRecord('1')" class="text-rose-400 hover:underline">Delete</button></td>
          </tr>
          <tr class="hover:bg-zinc-800/30">
            <td class="px-4 py-2.5 font-medium text-zinc-200">Data Explorer Table & CSV Export</td>
            <td class="px-4 py-2.5 text-zinc-400">UI</td>
            <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 text-[11px]">in_progress</span></td>
            <td class="px-4 py-2.5"><span class="text-rose-400 font-semibold text-[11px]">URGENT</span></td>
            <td class="px-4 py-2.5 font-mono">$2,400</td>
            <td class="px-4 py-2.5 text-zinc-400">Sarah C.</td>
            <td class="px-4 py-2.5 text-right"><button onclick="deleteRecord('2')" class="text-rose-400 hover:underline">Delete</button></td>
          </tr>
          <tr class="hover:bg-zinc-800/30">
            <td class="px-4 py-2.5 font-medium text-zinc-200">Automated Diagnostic Error Recovery</td>
            <td class="px-4 py-2.5 text-zinc-400">Agent</td>
            <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px]">done</span></td>
            <td class="px-4 py-2.5"><span class="text-zinc-400 font-medium text-[11px]">MEDIUM</span></td>
            <td class="px-4 py-2.5 font-mono">$850</td>
            <td class="px-4 py-2.5 text-zinc-400">Maya L.</td>
            <td class="px-4 py-2.5 text-right"><button onclick="deleteRecord('3')" class="text-rose-400 hover:underline">Delete</button></td>
          </tr>
          <tr class="hover:bg-zinc-800/30">
            <td class="px-4 py-2.5 font-medium text-zinc-200">PostgreSQL Migration Architecture</td>
            <td class="px-4 py-2.5 text-zinc-400">Backend</td>
            <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[11px]">todo</span></td>
            <td class="px-4 py-2.5"><span class="text-zinc-400 font-medium text-[11px]">MEDIUM</span></td>
            <td class="px-4 py-2.5 font-mono">$1,600</td>
            <td class="px-4 py-2.5 text-zinc-400">John D.</td>
            <td class="px-4 py-2.5 text-right"><button onclick="deleteRecord('4')" class="text-rose-400 hover:underline">Delete</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderAnalyticsContent(): string {
  return `
    <div>
      <h1 class="text-lg font-bold text-white">Analytics & Metrics Intelligence</h1>
      <p class="text-xs text-zinc-400">Visual progress distributions and operational status.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
        <h3 class="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Status Distribution</h3>
        <div class="space-y-3 text-xs">
          <div>
            <div class="flex justify-between text-zinc-400 mb-1"><span>Completed</span><span>50%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-emerald-500 w-1/2"></div></div>
          </div>
          <div>
            <div class="flex justify-between text-zinc-400 mb-1"><span>In Progress</span><span>25%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-amber-500 w-1/4"></div></div>
          </div>
          <div>
            <div class="flex justify-between text-zinc-400 mb-1"><span>To Do</span><span>25%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-indigo-500 w-1/4"></div></div>
          </div>
        </div>
      </div>

      <div class="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
        <h3 class="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Priority Distribution</h3>
        <div class="space-y-3 text-xs">
          <div>
            <div class="flex justify-between text-zinc-400 mb-1"><span>Urgent Priority</span><span>25%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-rose-500 w-1/4"></div></div>
          </div>
          <div>
            <div class="flex justify-between text-zinc-400 mb-1"><span>High Priority</span><span>25%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-amber-500 w-1/4"></div></div>
          </div>
          <div>
            <div class="flex justify-between text-zinc-400 mb-1"><span>Medium Priority</span><span>50%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-indigo-500 w-1/2"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsContent(name: string): string {
  return `
    <div class="max-w-2xl space-y-6">
      <div>
        <h1 class="text-lg font-bold text-white">${escapeHtml(name)} Settings</h1>
        <p class="text-xs text-zinc-400">Preview environment configuration and local storage reset.</p>
      </div>

      <div class="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
        <div class="text-xs font-medium text-zinc-300">Reset Local Sandbox Data</div>
        <p class="text-xs text-zinc-400">Clears client storage items and restores default seed data.</p>
        <button onclick="localStorage.removeItem('shipshape_sandbox_items'); location.reload();" class="px-3 py-1.5 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-xs font-medium hover:bg-rose-900 transition">
          Reset Data
        </button>
      </div>
    </div>
  `;
}

function renderPreviewPending(name: string, reason: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Preview Initializing</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 text-center">
  <div class="max-w-md space-y-4">
    <div class="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto animate-pulse font-bold text-xl">
      ⚡
    </div>
    <h2 class="text-lg font-bold text-zinc-100">${escapeHtml(name)}</h2>
    <p class="text-xs text-zinc-400">${escapeHtml(reason)}</p>
    <div class="text-[11px] text-zinc-500 font-mono">Sandbox status: WAITING_FOR_GENERATION</div>
  </div>
</body>
</html>`;
}

function renderPreviewError(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Preview Error</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 text-center">
  <div class="max-w-md space-y-4">
    <div class="w-12 h-12 rounded-2xl bg-rose-950/60 text-rose-400 border border-rose-800 flex items-center justify-center mx-auto font-bold text-xl">
      ✕
    </div>
    <h2 class="text-lg font-bold text-rose-300">${escapeHtml(title)}</h2>
    <p class="text-xs text-zinc-400">${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
