import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  requireAuth,
  AuthSessionError,
  getOwnedProject,
} from '@/lib/auth/session';
import { inferDomain } from '@/modules/planning/domain-catalog';

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
        renderPreviewPending(project.name, 'Application is synthesizing codebase and sandbox preview.'),
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
    const html = renderGeneratedPreviewApp(project.name, relativeRoute, files, spec, projectId);

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
  spec: any,
  projectId: string
): string {
  const isExplore = route === '/explore';
  const isAnalytics = route === '/analytics';
  const isSettings = route === '/settings';

  const domain = inferDomain(spec?.description || appName, appName);
  const brandInitial = (appName || 'A').trim().charAt(0).toUpperCase();

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
            brand: { 500: '${domain.accentHex}', 600: '${domain.accentHex}' }
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
<body class="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased selection:bg-emerald-500 selection:text-black">
  <!-- Dynamic Preview Header with App Brand Initial -->
  <header class="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <a href="?route=/" class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white text-xs shadow-md">
            ${brandInitial}
          </div>
          <span class="font-bold text-zinc-100 tracking-tight text-sm">${escapeHtml(appName)}</span>
        </a>
        <nav class="flex items-center gap-1 text-xs">
          <a href="?route=/" class="px-3 py-1.5 rounded-md ${!isExplore && !isAnalytics && !isSettings ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}">
            ${escapeHtml(domain.routes[0]?.name || 'Overview')}
          </a>
          <a href="?route=/explore" class="px-3 py-1.5 rounded-md ${isExplore ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}">
            ${escapeHtml(domain.routes[1]?.name || 'Explorer')}
          </a>
          <a href="?route=/analytics" class="px-3 py-1.5 rounded-md ${isAnalytics ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}">
            ${escapeHtml(domain.routes[2]?.name || 'Analytics')}
          </a>
          <a href="?route=/settings" class="px-3 py-1.5 rounded-md ${isSettings ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}">
            ${escapeHtml(domain.routes[3]?.name || 'Settings')}
          </a>
        </nav>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Ready · Live Sandbox
        </span>
      </div>
    </div>
  </header>

  <!-- Route Content -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
    ${isExplore
      ? renderDomainExplorer(domain)
      : isAnalytics
        ? renderDomainAnalytics(domain)
        : isSettings
          ? renderDomainSettings(appName, domain, projectId)
          : renderDomainHome(appName, spec?.description, domain)
    }
  </main>

  <script>
    // Prompt-aware interactive client state manager
    const STORAGE_KEY = 'shipshape_sandbox_${projectId}_v2';
    const DEFAULT_SEED = ${JSON.stringify(domain.seedItems)};
    const DOMAIN_TYPE = '${domain.domainId}';

    function loadItems() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : DEFAULT_SEED;
      } catch (e) {
        return DEFAULT_SEED;
      }
    }

    function saveItems(items) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        renderApp();
      } catch (e) {
        console.error('Failed to save sandbox storage:', e);
      }
    }

    // Toggle todo task completion
    function toggleTodo(id) {
      const items = loadItems();
      const updated = items.map(item => {
        if (item.id === id) {
          const newStatus = item.status === 'done' ? 'todo' : 'done';
          return { ...item, status: newStatus, completed: newStatus === 'done' };
        }
        return item;
      });
      saveItems(updated);
    }

    // Add new item
    function addNewItem(title, category, priority, amount) {
      if (!title || !title.trim()) return;
      const items = loadItems();
      const newItem = {
        id: 'item_' + Date.now(),
        title: title.trim(),
        category: category || 'General',
        priority: priority || 'medium',
        status: DOMAIN_TYPE === 'todo' ? 'todo' : 'active',
        completed: false,
        amount: Number(amount) || 0,
        price: Number(amount) || 25,
        rating: 5.0,
        stock: 20,
        createdAt: new Date().toISOString()
      };
      saveItems([newItem, ...items]);
    }

    function deleteItem(id) {
      const items = loadItems();
      saveItems(items.filter(i => i.id !== id));
    }

    function exportCSV() {
      const items = loadItems();
      if (!items || items.length === 0) {
        alert('No records available to export.');
        return;
      }
      const keys = Object.keys(items[0]).filter(k => k !== 'content');
      const csv = [
        keys.join(','),
        ...items.map(row => keys.map(k => '"' + (String(row[k] || '')).replace(/"/g, '""') + '"').join(','))
      ].join('\\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-data.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    function renderApp() {
      // Re-evaluate reactive statistics and item lists
      const items = loadItems();
      const totalEl = document.getElementById('stat-total');
      const completedEl = document.getElementById('stat-completed');
      const pendingEl = document.getElementById('stat-pending');
      const rateEl = document.getElementById('stat-rate');

      if (totalEl) totalEl.innerText = items.length;
      if (completedEl) {
        const c = items.filter(i => i.status === 'done' || i.completed).length;
        completedEl.innerText = c;
      }
      if (pendingEl) {
        const p = items.filter(i => i.status !== 'done' && !i.completed).length;
        pendingEl.innerText = p;
      }
      if (rateEl) {
        const c = items.filter(i => i.status === 'done' || i.completed).length;
        const rate = items.length > 0 ? Math.round((c / items.length) * 100) : 0;
        rateEl.innerText = rate + '%';
      }

      // Re-render dynamic list if container exists
      const listContainer = document.getElementById('dynamic-items-list');
      if (listContainer) {
        listContainer.innerHTML = items.map(item => {
          const isDone = item.status === 'done' || item.completed;
          return \`
            <div class="py-3 px-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3 group hover:border-zinc-700 transition">
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  \${isDone ? 'checked' : ''}
                  onchange="toggleTodo('\${item.id}')"
                  class="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <div>
                  <div class="text-xs sm:text-sm font-medium \${isDone ? 'line-through text-zinc-500' : 'text-zinc-200'}">
                    \${item.title}
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                    <span>\${item.category || 'General'}</span>
                    \${item.dueDate ? \`<span>• Due \${item.dueDate}</span>\` : ''}
                    \${item.amount ? \`<span>• $\${item.amount}</span>\` : ''}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase \${
                  item.priority === 'urgent'
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : item.priority === 'high'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-zinc-800 text-zinc-400'
                }">
                  \${item.priority || 'Normal'}
                </span>
                <button onclick="deleteItem('\${item.id}')" class="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-1 transition text-xs">
                  ✕
                </button>
              </div>
            </div>
          \`;
        }).join('');
      }
    }

    // Attach form listener
    document.addEventListener('DOMContentLoaded', () => {
      const form = document.getElementById('add-item-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const titleInput = document.getElementById('new-item-title');
          const categoryInput = document.getElementById('new-item-category');
          const priorityInput = document.getElementById('new-item-priority');
          if (titleInput && titleInput.value.trim()) {
            addNewItem(titleInput.value, categoryInput ? categoryInput.value : '', priorityInput ? priorityInput.value : 'medium');
            titleInput.value = '';
          }
        });
      }
      renderApp();
    });
  </script>
</body>
</html>`;
}

function renderDomainHome(name: string, desc: string | undefined, domain: any): string {
  const isTodo = domain.domainId === 'todo';
  const isFinance = domain.domainId === 'finance';
  const isEcommerce = domain.domainId === 'ecommerce';

  return `
    <!-- Top Welcome Banner -->
    <div class="p-6 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
            ${escapeHtml(domain.domainTitle)}
          </span>
        </div>
        <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">${escapeHtml(name)}</h1>
        <p class="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">${escapeHtml(desc || domain.domainSubtitle)}</p>
      </div>
      <div class="flex gap-2">
        <a href="?route=/explore" class="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-lg shadow-white/10 transition">
          Open Data Table →
        </a>
      </div>
    </div>

    <!-- Domain Specific KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800">
        <div class="text-xs font-medium text-zinc-400">${escapeHtml(domain.kpiCards[0]?.label || 'Total Items')}</div>
        <div class="text-xl sm:text-2xl font-bold text-zinc-100 mt-1" id="stat-total">${domain.seedItems.length}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">${escapeHtml(domain.kpiCards[0]?.subtext || 'Verified')}</div>
      </div>
      <div class="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800">
        <div class="text-xs font-medium text-zinc-400">${escapeHtml(domain.kpiCards[1]?.label || 'Completed')}</div>
        <div class="text-xl sm:text-2xl font-bold text-emerald-400 mt-1" id="stat-completed">
          ${isFinance ? '$1,850' : isEcommerce ? '82' : domain.seedItems.filter((i: any) => i.status === 'done' || i.completed).length}
        </div>
        <div class="text-[11px] text-zinc-500 mt-0.5">${escapeHtml(domain.kpiCards[1]?.subtext || 'In runtime')}</div>
      </div>
      <div class="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800">
        <div class="text-xs font-medium text-zinc-400">${escapeHtml(domain.kpiCards[2]?.label || 'Pending')}</div>
        <div class="text-xl sm:text-2xl font-bold text-amber-400 mt-1" id="stat-pending">
          ${isFinance ? '$258' : isEcommerce ? '4.8 ★' : domain.seedItems.filter((i: any) => i.status !== 'done' && !i.completed).length}
        </div>
        <div class="text-[11px] text-zinc-500 mt-0.5">${escapeHtml(domain.kpiCards[2]?.subtext || 'Active')}</div>
      </div>
      <div class="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800">
        <div class="text-xs font-medium text-zinc-400">${escapeHtml(domain.kpiCards[3]?.label || 'Metric')}</div>
        <div class="text-xl sm:text-2xl font-bold text-zinc-200 mt-1" id="stat-rate">
          ${isFinance ? '+$1,592' : isEcommerce ? '$3,240' : '40%'}
        </div>
        <div class="text-[11px] text-zinc-500 mt-0.5">${escapeHtml(domain.kpiCards[3]?.subtext || 'Healthy')}</div>
      </div>
    </div>

    <!-- Quick Add Form -->
    <div class="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-xs sm:text-sm font-semibold text-zinc-200">
          ${isTodo ? 'Add New Task' : isFinance ? 'Quick Transaction Log' : 'Create New ' + domain.entityName}
        </h2>
        <span class="text-[11px] text-zinc-500 font-mono">Immediate local persistence</span>
      </div>
      <form id="add-item-form" class="flex flex-col sm:flex-row gap-2.5">
        <input
          id="new-item-title"
          type="text"
          required
          placeholder="${isTodo ? 'What task needs to be completed? (e.g. Schedule team retrospective)' : isFinance ? 'Description (e.g. Server hosting, Groceries)' : 'Enter record title...'}"
          class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400"
        />
        <input
          id="new-item-category"
          type="text"
          placeholder="Category (e.g. Work, Tech)"
          class="w-full sm:w-36 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400"
        />
        <select
          id="new-item-priority"
          class="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-400"
        >
          <option value="low">Low Priority</option>
          <option value="medium" selected>Medium Priority</option>
          <option value="high">High Priority</option>
          <option value="urgent">Urgent</option>
        </select>
        <button
          type="submit"
          class="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition shrink-0 cursor-pointer shadow-md"
        >
          ${escapeHtml(domain.primaryActionLabel)}
        </button>
      </form>
    </div>

    <!-- Live Interactive Item Feed -->
    <div class="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-semibold text-zinc-100">
            ${isTodo ? 'Task Checklist' : 'Active ' + domain.entityName + ' Stream'}
          </h2>
          <span class="text-[11px] font-mono text-zinc-500">Click checkbox to toggle</span>
        </div>
        <a href="?route=/explore" class="text-xs text-emerald-400 hover:underline">View all records →</a>
      </div>

      <div class="space-y-2.5" id="dynamic-items-list">
        <!-- Rendered by client JavaScript with real data -->
      </div>
    </div>
  `;
}

function renderDomainExplorer(domain: any): string {
  return `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-bold text-white">${escapeHtml(domain.routes[1]?.name || 'Data Explorer')}</h1>
        <p class="text-xs text-zinc-400">Interactive table with multi-criteria filtering, search, and CSV export.</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="exportCSV()" class="px-3.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 transition cursor-pointer">
          Export CSV
        </button>
      </div>
    </div>

    <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
      <div class="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
        <input
          type="text"
          id="table-search"
          placeholder="Filter records by title or category..."
          class="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400 w-full max-w-sm"
        />
        <span class="text-[11px] text-zinc-500 font-mono">Live Search</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-zinc-300">
          <thead class="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800">
            <tr>
              <th class="px-4 py-3">Title / Description</th>
              <th class="px-4 py-3">Category</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Priority</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800/60" id="explorer-tbody">
            ${domain.seedItems
      .map(
        (item: any) => `
              <tr class="hover:bg-zinc-800/30">
                <td class="px-4 py-3 font-medium text-zinc-200">${escapeHtml(item.title)}</td>
                <td class="px-4 py-3 text-zinc-400">${escapeHtml(item.category || 'General')}</td>
                <td class="px-4 py-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${item.status === 'done' || item.completed
            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
            : 'bg-zinc-800 text-zinc-300'
          }">
                    ${escapeHtml(item.status || 'active')}
                  </span>
                </td>
                <td class="px-4 py-3 text-zinc-400 uppercase text-[10px] font-semibold">${escapeHtml(item.priority || 'medium')}</td>
                <td class="px-4 py-3 text-right">
                  <button onclick="deleteItem('${item.id}'); location.reload();" class="text-rose-400 hover:underline">Delete</button>
                </td>
              </tr>
            `
      )
      .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDomainAnalytics(domain: any): string {
  return `
    <div>
      <h1 class="text-lg font-bold text-white">${escapeHtml(domain.routes[2]?.name || 'Analytics & Insights')}</h1>
      <p class="text-xs text-zinc-400">Visual performance breakdowns, velocity metrics, and priority distributions.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <h3 class="text-xs font-bold text-zinc-200 uppercase tracking-wider">Completion & Status Breakdown</h3>
        <div class="space-y-3.5 text-xs">
          <div>
            <div class="flex justify-between text-zinc-300 mb-1"><span>Completed Milestones</span><span class="font-mono text-emerald-400">60%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-emerald-500 w-3/5"></div></div>
          </div>
          <div>
            <div class="flex justify-between text-zinc-300 mb-1"><span>Active In Progress</span><span class="font-mono text-amber-400">30%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-amber-500 w-3/10"></div></div>
          </div>
          <div>
            <div class="flex justify-between text-zinc-300 mb-1"><span>Pending Backlog</span><span class="font-mono text-zinc-400">10%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-zinc-600 w-1/10"></div></div>
          </div>
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <h3 class="text-xs font-bold text-zinc-200 uppercase tracking-wider">Priority Distribution</h3>
        <div class="space-y-3.5 text-xs">
          <div>
            <div class="flex justify-between text-zinc-300 mb-1"><span>Urgent Priority</span><span class="font-mono text-rose-400">25%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-rose-500 w-1/4"></div></div>
          </div>
          <div>
            <div class="flex justify-between text-zinc-300 mb-1"><span>High Priority</span><span class="font-mono text-amber-400">35%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-amber-500 w-[35%]"></div></div>
          </div>
          <div>
            <div class="flex justify-between text-zinc-300 mb-1"><span>Standard & Normal</span><span class="font-mono text-zinc-400">40%</span></div>
            <div class="h-2 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full bg-zinc-600 w-2/5"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDomainSettings(name: string, domain: any, projectId: string): string {
  return `
    <div class="max-w-2xl space-y-6">
      <div>
        <h1 class="text-lg font-bold text-white">${escapeHtml(name)} Settings</h1>
        <p class="text-xs text-zinc-400">Sandbox state preferences, data export, and browser storage controls.</p>
      </div>

      <div class="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <div>
          <h3 class="text-xs font-bold text-zinc-200">Reset Local Sandbox Data</h3>
          <p class="text-xs text-zinc-400 mt-1">Clears client-stored items and resets back to the initial curated domain seed data.</p>
        </div>
        <button
          onclick="localStorage.removeItem('shipshape_sandbox_${projectId}_v2'); location.reload();"
          class="px-4 py-2 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold hover:bg-rose-900 transition cursor-pointer"
        >
          Reset to Default Seed Data
        </button>
      </div>

      <div class="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
        <h3 class="text-xs font-bold text-zinc-200">Architecture Specification</h3>
        <div class="text-xs text-zinc-400 space-y-1 font-mono">
          <div>Domain Category: <span class="text-zinc-200">${escapeHtml(domain.domainTitle)}</span></div>
          <div>Primary Entity: <span class="text-zinc-200">${escapeHtml(domain.entityName)}</span></div>
          <div>Storage Engine: <span class="text-emerald-400">Local Persistence Engine (Client-Safe)</span></div>
        </div>
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
    <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto animate-pulse font-bold text-xl">
      ⚡
    </div>
    <h2 class="text-lg font-bold text-zinc-100">${escapeHtml(name)}</h2>
    <p class="text-xs text-zinc-400">${escapeHtml(reason)}</p>
    <div class="text-[11px] text-zinc-500 font-mono">Status: SYNTHESIZING_CODEBASE</div>
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
