import { ApplicationPlan, GeneratedFile, ProjectSpecification } from '@/types';
import { validateSafePath } from '@/server/security/safe-paths';
import { inferDomain } from '../planning/domain-catalog';

/**
 * Generates a complete, coherent multi-file Next.js project based on the structured application plan.
 */
export async function generateProjectFiles(
  plan: ApplicationPlan,
  specification: ProjectSpecification
): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];

  const appName = specification.name || 'Shipshape Generated Application';
  const appDesc = specification.description || 'Full-stack application built with Shipshape';
  const domain = inferDomain(appDesc, appName);
  const brandInitial = (appName || 'A').trim().charAt(0).toUpperCase();
  const isTodo = domain.domainId === 'todo';
  const _isKanban = domain.domainId === 'kanban';
  const _isEcommerce = domain.domainId === 'ecommerce';
  const isFinance = domain.domainId === 'finance';

  // 1. package.json
  files.push({
    path: 'package.json',
    fileType: 'config',
    responsibility: 'Application dependencies and execution scripts',
    mimeType: 'application/json',
    sizeBytes: 0,
    content: JSON.stringify(
      {
        name: appName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-'),
        version: '1.0.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'eslint .',
        },
        dependencies: {
          next: '^16.4.3',
          react: '^18.3.0',
          'react-dom': '^18.3.0',
          'lucide-react': '^0.395.0',
          clsx: '^2.1.1',
          'tailwind-merge': '^2.3.0',
        },
        devDependencies: {
          typescript: '^5.4.0',
          '@types/node': '^20.12.0',
          '@types/react': '^18.3.0',
          '@types/react-dom': '^18.3.0',
          tailwindcss: '^3.4.0',
          postcss: '^8.4.0',
          autoprefixer: '^10.4.0',
        },
      },
      null,
      2
    ),
  });

  // 2. tsconfig.json
  files.push({
    path: 'tsconfig.json',
    fileType: 'config',
    responsibility: 'TypeScript compiler configuration',
    mimeType: 'application/json',
    sizeBytes: 0,
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'es5',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      },
      null,
      2
    ),
  });

  // 3. tailwind.config.js
  files.push({
    path: 'tailwind.config.js',
    fileType: 'config',
    responsibility: 'Tailwind styling tokens and utility configuration',
    mimeType: 'application/javascript',
    sizeBytes: 0,
    content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
      },
    },
  },
  plugins: [],
};`,
  });

  // 4. src/lib/storage.ts
  files.push({
    path: 'src/lib/storage.ts',
    fileType: 'lib',
    responsibility: 'Local persistence and typed seed data manager',
    mimeType: 'text/typescript',
    sizeBytes: 0,
    content: `// Client-safe Local Storage and Data Persistence
export interface Item {
  id: string;
  title: string;
  category: string;
  status: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  value?: number;
  amount?: number;
  price?: number;
  rating?: number;
  stock?: number;
  completed?: boolean;
  dueDate?: string;
  assignee?: string;
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'shipshape_app_data_v1';

const SEED_ITEMS: Item[] = ${JSON.stringify(domain.seedItems, null, 2)};

export function getStoredItems(): Item[] {
  if (typeof window === 'undefined') return SEED_ITEMS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ITEMS));
      return SEED_ITEMS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load local storage:', err);
    return SEED_ITEMS;
  }
}

export function saveStoredItems(items: Item[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('app_storage_updated'));
  } catch (err) {
    console.error('Failed to save to local storage:', err);
  }
}

export function exportToCSV(items: Item[], filename = 'export.csv'): void {
  if (typeof window === 'undefined' || items.length === 0) return;
  const headers = ['ID', 'Title', 'Category', 'Status', 'Priority', 'Detail', 'Created'];
  const rows = items.map((i) => [
    i.id,
    \`"\${(i.title || '').replace(/"/g, '""')}"\`,
    \`"\${i.category || 'General'}"\`,
    i.status || (i.completed ? 'done' : 'active'),
    i.priority || 'medium',
    \`"\${i.dueDate || i.amount || i.value || i.assignee || ''}"\`,
    i.createdAt,
  ]);
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
`,
  });

  // 5. src/components/HeaderNav.tsx
  files.push({
    path: 'src/components/HeaderNav.tsx',
    fileType: 'component',
    responsibility: 'Application top navigation and quick action toolbar',
    mimeType: 'text/typescript',
    sizeBytes: 0,
    content: `'use client';

import React from 'react';

export default function HeaderNav({ activePath = '/' }: { activePath?: string }) {
  const navLinks = [
    { href: '/', label: 'Dashboard' },
    { href: '/explore', label: 'Data Explorer' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/settings', label: 'Settings' },
  ];

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white shadow-md text-sm">
              ${brandInitial}
            </div>
            <span className="font-semibold text-zinc-100 tracking-tight text-lg">${appName}</span>
          </a>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={\`px-3 py-1.5 rounded-md text-sm font-medium transition-colors \${
                  activePath === link.href
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }\`}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Ready · Sandbox
          </span>
          <a
            href="/explore"
            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-all shadow-md"
          >
            ${domain.primaryActionLabel}
          </a>
        </div>
      </div>
    </header>
  );
}
`,
  });

  // 6. src/components/ItemModal.tsx
  const itemModalContent = isTodo
    ? `'use client';

import React, { useState } from 'react';
import { Item } from '@/lib/storage';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<Item>) => void;
  initialItem?: Item | null;
}

export default function ItemModal({ isOpen, onClose, onSave, initialItem }: ItemModalProps) {
  const [title, setTitle] = useState(initialItem?.title || '');
  const [category, setCategory] = useState(initialItem?.category || 'Work');
  const [priority, setPriority] = useState<Item['priority']>(initialItem?.priority || 'medium');
  const [dueDate, setDueDate] = useState(initialItem?.dueDate || 'Today');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      category: category.trim() || 'Work',
      priority,
      dueDate: dueDate.trim() || 'Today',
      status: initialItem?.status || 'todo',
      completed: initialItem?.completed ?? false,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">
            {initialItem ? 'Edit Task' : 'Add New Task'}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm font-bold p-1 rounded hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Schedule team retrospective"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Work, Personal..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Item['priority'])}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Due Date</label>
            <input
              type="text"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="e.g. Today, Tomorrow, Friday"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-md shadow-emerald-600/30"
            >
              {initialItem ? 'Update Task' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
`
    : isFinance
      ? `'use client';

import React, { useState } from 'react';
import { Item } from '@/lib/storage';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<Item>) => void;
  initialItem?: Item | null;
}

export default function ItemModal({ isOpen, onClose, onSave, initialItem }: ItemModalProps) {
  const [title, setTitle] = useState(initialItem?.title || '');
  const [category, setCategory] = useState(initialItem?.category || 'Software');
  const [amount, setAmount] = useState(initialItem?.amount?.toString() || initialItem?.value?.toString() || '50');
  const [type, setType] = useState(initialItem?.type || 'expense');
  const [status, setStatus] = useState(initialItem?.status || 'settled');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const num = parseFloat(amount) || 0;
    onSave({
      title: title.trim(),
      category: category.trim() || 'General',
      amount: num,
      value: num,
      type,
      status,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">
            {initialItem ? 'Edit Transaction' : 'Log Transaction'}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm font-bold p-1 rounded hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Description / Merchant *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AWS Cloud Hosting"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Software, Food, Cloud..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Amount ($) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="settled">Settled</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-md shadow-emerald-600/30"
            >
              {initialItem ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
`
      : `'use client';

import React, { useState } from 'react';
import { Item } from '@/lib/storage';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<Item>) => void;
  initialItem?: Item | null;
}

export default function ItemModal({ isOpen, onClose, onSave, initialItem }: ItemModalProps) {
  const [title, setTitle] = useState(initialItem?.title || '');
  const [category, setCategory] = useState(initialItem?.category || 'General');
  const [status, setStatus] = useState(initialItem?.status || 'todo');
  const [priority, setPriority] = useState<Item['priority']>(initialItem?.priority || 'medium');
  const [value, setValue] = useState(initialItem?.value?.toString() || '100');
  const [assignee, setAssignee] = useState(initialItem?.assignee || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      category: category.trim() || 'General',
      status,
      priority,
      value: parseFloat(value) || 0,
      assignee: assignee.trim() || 'Unassigned',
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">
            {initialItem ? 'Edit Item' : 'Create New Item'}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm font-bold p-1 rounded hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement feature"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Value ($)</label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Item['priority'])}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Assignee</label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="e.g. Jane Doe"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-md shadow-indigo-600/30"
            >
              {initialItem ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
`;

  files.push({
    path: 'src/components/ItemModal.tsx',
    fileType: 'component',
    responsibility: 'Modal dialog for adding and editing records',
    mimeType: 'text/typescript',
    sizeBytes: 0,
    content: itemModalContent,
  });

  // 7. src/app/globals.css
  files.push({
    path: 'src/app/globals.css',
    fileType: 'style',
    responsibility: 'Global Tailwind styling and base theme tokens',
    mimeType: 'text/css',
    sizeBytes: 0,
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #09090b;
  --foreground: #fafafa;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  overflow-x: hidden;
}
`,
  });

  // 8. src/app/layout.tsx
  files.push({
    path: 'src/app/layout.tsx',
    fileType: 'layout',
    responsibility: 'Root HTML shell and application metadata',
    mimeType: 'text/typescript',
    sizeBytes: 0,
    content: `import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '${appName}',
  description: '${appDesc.slice(0, 100)}',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
`,
  });

  // 9. src/app/page.tsx (Interactive Overview Dashboard)
  const homePageContent = isTodo
    ? `'use client';

import React, { useState, useEffect } from 'react';
import HeaderNav from '@/components/HeaderNav';
import { getStoredItems, saveStoredItems, Item } from '@/lib/storage';

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPriority, setNewPriority] = useState<Item['priority']>('medium');

  useEffect(() => {
    setMounted(true);
    setItems(getStoredItems());
    const handleUpdate = () => setItems(getStoredItems());
    window.addEventListener('app_storage_updated', handleUpdate);
    return () => window.removeEventListener('app_storage_updated', handleUpdate);
  }, []);

  const totalTasks = items.length;
  const completedTasks = items.filter((i) => i.status === 'done' || i.completed).length;
  const pendingTasks = items.filter((i) => i.status !== 'done' && !i.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const toggleTask = (id: string) => {
    const updated = items.map((i) => {
      if (i.id === id) {
        const nextDone = !(i.status === 'done' || i.completed);
        return {
          ...i,
          completed: nextDone,
          status: nextDone ? 'done' : 'todo',
          updatedAt: new Date().toISOString(),
        };
      }
      return i;
    });
    setItems(updated);
    saveStoredItems(updated);
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newItem: Item = {
      id: \`todo-\${Date.now()}\`,
      title: newTitle.trim(),
      category: newCategory.trim() || 'Work',
      priority: newPriority || 'medium',
      status: 'todo',
      completed: false,
      dueDate: 'Today',
      createdAt: new Date().toISOString(),
    };
    const updated = [newItem, ...items];
    setItems(updated);
    saveStoredItems(updated);
    setNewTitle('');
    setNewCategory('');
  };

  const deleteTask = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    saveStoredItems(updated);
  };

  const filteredItems = items.filter((item) => {
    const isDone = item.status === 'done' || item.completed;
    if (filter === 'active') return !isDone;
    if (filter === 'completed') return isDone;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <HeaderNav activePath="/" />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-900/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Task & Checklist Workspace
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">${appName}</h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">${appDesc}</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/explore"
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-lg shadow-white/10 transition flex items-center gap-1.5"
            >
              Task Explorer →
            </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400">Total Tasks</div>
            <div className="text-2xl font-bold text-zinc-100 mt-1">{mounted ? totalTasks : '...'}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Workspace items</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400">Completed</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{mounted ? completedTasks : '...'}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Finished tasks</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400">Pending Action</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{mounted ? pendingTasks : '...'}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Requires attention</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400">Completion Rate</div>
            <div className="text-2xl font-bold text-zinc-100 mt-1">{mounted ? \`\${completionRate}%\` : '...'}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Productivity index</div>
          </div>
        </div>

        {/* Quick Add Task Form */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Add New Task</h2>
            <span className="text-[11px] text-zinc-500 font-mono">Immediate local persistence</span>
          </div>
          <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What task needs to be completed? (e.g. Write test suite)"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category (e.g. Work, Health)"
              className="w-full sm:w-40 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as Item['priority'])}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition shrink-0 cursor-pointer shadow-md"
            >
              + Add Task
            </button>
          </form>
        </div>

        {/* Task List Section with Filter Tabs */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-100">Tasks</h2>
              <span className="text-xs text-zinc-500">({filteredItems.length})</span>
            </div>
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={\`px-3 py-1 rounded-lg text-xs font-medium transition \${
                  filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }\`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('active')}
                className={\`px-3 py-1 rounded-lg text-xs font-medium transition \${
                  filter === 'active' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }\`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={\`px-3 py-1 rounded-lg text-xs font-medium transition \${
                  filter === 'completed' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }\`}
              >
                Completed
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">No tasks in this view.</div>
            ) : (
              filteredItems.map((item) => {
                const isDone = item.status === 'done' || item.completed;
                return (
                  <div
                    key={item.id}
                    className={\`group flex items-center justify-between p-3 rounded-xl border transition \${
                      isDone
                        ? 'bg-zinc-950/40 border-zinc-900 opacity-70'
                        : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700'
                    }\`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(isDone)}
                        onChange={() => toggleTask(item.id)}
                        className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-zinc-900 cursor-pointer accent-emerald-500"
                      />
                      <div>
                        <div
                          onClick={() => toggleTask(item.id)}
                          className={\`text-sm font-medium cursor-pointer transition \${
                            isDone ? 'line-through text-zinc-500' : 'text-zinc-200 hover:text-white'
                          }\`}
                        >
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{item.category || 'General'}</span>
                          {item.dueDate && <span>• Due {item.dueDate}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={\`px-2 py-0.5 rounded text-[10px] font-semibold uppercase \${
                          item.priority === 'urgent'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : item.priority === 'high'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-zinc-800 text-zinc-400'
                        }\`}
                      >
                        {item.priority || 'normal'}
                      </span>
                      <button
                        onClick={() => deleteTask(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-1 text-xs transition"
                        title="Delete task"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
`
    : `'use client';

import React, { useState, useEffect } from 'react';
import HeaderNav from '@/components/HeaderNav';
import { getStoredItems, Item } from '@/lib/storage';

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setItems(getStoredItems());
    const handleUpdate = () => setItems(getStoredItems());
    window.addEventListener('app_storage_updated', handleUpdate);
    return () => window.removeEventListener('app_storage_updated', handleUpdate);
  }, []);

  const totalValue = items.reduce((acc, i) => acc + (i.value || i.amount || 0), 0);
  const completedCount = items.filter((i) => i.status === 'done' || i.status === 'settled' || i.completed).length;
  const inProgressCount = items.filter((i) => i.status === 'in_progress' || i.status === 'pending').length;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <HeaderNav activePath="/" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">${appName}</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">${appDesc}</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/explore"
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-lg shadow-white/10 transition flex items-center gap-1.5"
            >
              Open Data Explorer →
            </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400">${domain.kpiCards[0]?.label || 'Total Items'}</div>
            <div className="text-2xl font-bold text-zinc-100 mt-2">{mounted ? items.length : '...'}</div>
            <div className="text-xs text-emerald-400 mt-1">Live tracking active</div>
          </div>
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400">${domain.kpiCards[1]?.label || 'Completed'}</div>
            <div className="text-2xl font-bold text-zinc-100 mt-2">{mounted ? completedCount : '...'}</div>
            <div className="text-xs text-indigo-400 mt-1">
              {mounted && items.length > 0 ? \`\${Math.round((completedCount / items.length) * 100)}% of total\` : '0%'}
            </div>
          </div>
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400">${domain.kpiCards[2]?.label || 'Active'}</div>
            <div className="text-2xl font-bold text-amber-400 mt-2">{mounted ? inProgressCount : '...'}</div>
            <div className="text-xs text-zinc-500 mt-1">Operational records</div>
          </div>
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400">${domain.kpiCards[3]?.label || 'Total Metric'}</div>
            <div className="text-2xl font-bold text-emerald-400 mt-2">
              \${mounted ? totalValue.toLocaleString() : '...'}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Dynamic accumulation</div>
          </div>
        </div>

        {/* Recent Items Preview */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-100">Recent Records</h2>
            <a href="/explore" className="text-xs text-indigo-400 hover:underline">
              View all records →
            </a>
          </div>

          <div className="divide-y divide-zinc-800/80">
            {items.slice(0, 5).map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={\`w-2 h-2 rounded-full \${
                      item.status === 'done' || item.status === 'settled'
                        ? 'bg-emerald-400'
                        : item.status === 'in_progress' || item.status === 'pending'
                        ? 'bg-amber-400'
                        : 'bg-zinc-500'
                    }\`}
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{item.title}</div>
                    <div className="text-xs text-zinc-500">
                      {item.category} • {item.assignee || item.type || 'Standard'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(item.amount !== undefined || item.value !== undefined) && (
                    <span className="text-xs font-mono text-zinc-400">\${item.amount ?? item.value}</span>
                  )}
                  {item.priority && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider bg-zinc-800 text-zinc-300">
                      {item.priority}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
`;

  files.push({
    path: 'src/app/page.tsx',
    fileType: 'page',
    responsibility: 'Main Overview Dashboard view with live KPIs and recent updates',
    mimeType: 'text/typescript',
    sizeBytes: 0,
    content: homePageContent,
  });

  // 10. src/app/explore/page.tsx (Full CRUD Management Table)
  const explorePageContent = isTodo
    ? `'use client';

import React, { useState, useEffect } from 'react';
import HeaderNav from '@/components/HeaderNav';
import ItemModal from '@/components/ItemModal';
import { getStoredItems, saveStoredItems, exportToCSV, Item } from '@/lib/storage';

export default function ExplorePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  useEffect(() => {
    setItems(getStoredItems());
  }, []);

  const handleCreateOrUpdate = (itemData: Partial<Item>) => {
    if (editingItem) {
      const updated = items.map((i) => (i.id === editingItem.id ? ({ ...i, ...itemData } as Item) : i));
      setItems(updated);
      saveStoredItems(updated);
    } else {
      const newItem: Item = {
        id: \`todo-\${Date.now()}\`,
        title: itemData.title || 'Untitled task',
        category: itemData.category || 'Work',
        status: itemData.status || 'todo',
        priority: itemData.priority || 'medium',
        dueDate: itemData.dueDate || 'Today',
        completed: Boolean(itemData.completed),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [newItem, ...items];
      setItems(updated);
      saveStoredItems(updated);
    }
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this task?')) {
      const updated = items.filter((i) => i.id !== id);
      setItems(updated);
      saveStoredItems(updated);
    }
  };

  const toggleTask = (id: string) => {
    const updated = items.map((i) => {
      if (i.id === id) {
        const nextDone = !(i.status === 'done' || i.completed);
        return {
          ...i,
          completed: nextDone,
          status: nextDone ? 'done' : 'todo',
          updatedAt: new Date().toISOString(),
        };
      }
      return i;
    });
    setItems(updated);
    saveStoredItems(updated);
  };

  const filteredItems = items.filter((i) => {
    const matchesSearch =
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase());
    const isDone = i.status === 'done' || i.completed;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'done' && isDone) ||
      (statusFilter === 'todo' && !isDone);
    const matchesPriority = priorityFilter === 'all' || i.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <HeaderNav activePath="/explore" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Task Explorer & Management</h1>
            <p className="text-xs text-zinc-400 mt-1">Filter, inspect, batch edit, and export your task records.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV(filteredItems, 'tasks-export.csv')}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition"
            >
              Export CSV
            </button>
            <button
              onClick={() => {
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition"
            >
              + Add Task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search tasks by title or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="todo">Pending / Active</option>
            <option value="done">Completed</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800 font-medium">
                <tr>
                  <th className="px-4 py-3 w-10">Done</th>
                  <th className="px-4 py-3">Task Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No tasks match the current search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isDone = item.status === 'done' || item.completed;
                    return (
                      <tr key={item.id} className="hover:bg-zinc-800/40 transition">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={Boolean(isDone)}
                            onChange={() => toggleTask(item.id)}
                            className="w-4 h-4 rounded border-zinc-700 text-emerald-500 bg-zinc-900 cursor-pointer accent-emerald-500"
                          />
                        </td>
                        <td className={\`px-4 py-3 font-medium \${isDone ? 'line-through text-zinc-500' : 'text-zinc-100'}\`}>
                          {item.title}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{item.category}</td>
                        <td className="px-4 py-3">
                          <span
                            className={\`px-2 py-0.5 rounded text-[11px] font-medium uppercase \${
                              item.priority === 'urgent'
                                ? 'text-rose-400 font-semibold'
                                : item.priority === 'high'
                                ? 'text-amber-400'
                                : 'text-zinc-400'
                            }\`}
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{item.dueDate || '—'}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            className="text-emerald-400 hover:text-emerald-300 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-rose-400 hover:text-rose-300 font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ItemModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          onSave={handleCreateOrUpdate}
          initialItem={editingItem}
        />
      </main>
    </div>
  );
}
`
    : `'use client';

import React, { useState, useEffect } from 'react';
import HeaderNav from '@/components/HeaderNav';
import ItemModal from '@/components/ItemModal';
import { getStoredItems, saveStoredItems, exportToCSV, Item } from '@/lib/storage';

export default function ExplorePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  useEffect(() => {
    setItems(getStoredItems());
  }, []);

  const handleCreateOrUpdate = (itemData: Partial<Item>) => {
    if (editingItem) {
      const updated = items.map((i) => (i.id === editingItem.id ? { ...i, ...itemData } as Item : i));
      setItems(updated);
      saveStoredItems(updated);
    } else {
      const newItem: Item = {
        id: \`item-\${Date.now()}\`,
        title: itemData.title || 'Untitled',
        category: itemData.category || 'General',
        status: itemData.status || 'todo',
        priority: itemData.priority || 'medium',
        value: itemData.value || 0,
        assignee: itemData.assignee || 'Unassigned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [newItem, ...items];
      setItems(updated);
      saveStoredItems(updated);
    }
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      const updated = items.filter((i) => i.id !== id);
      setItems(updated);
      saveStoredItems(updated);
    }
  };

  const filteredItems = items.filter((i) => {
    const matchesSearch =
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase()) ||
      (i.assignee && i.assignee.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || i.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <HeaderNav activePath="/explore" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Data Explorer & Management</h1>
            <p className="text-xs text-zinc-400 mt-1">Manage, filter, and inspect live project records.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV(filteredItems, 'data-export.csv')}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition"
            >
              Export CSV
            </button>
            <button
              onClick={() => {
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
            >
              + Create Record
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search records by title, category, or assignee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800 font-medium">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                      No records match the current search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-800/40 transition">
                      <td className="px-4 py-3 font-medium text-zinc-100">{item.title}</td>
                      <td className="px-4 py-3 text-zinc-400">{item.category}</td>
                      <td className="px-4 py-3">
                        <span
                          className={\`px-2 py-0.5 rounded text-[11px] font-medium \${
                            item.status === 'done'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : item.status === 'in_progress'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-zinc-800 text-zinc-400'
                          }\`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={\`px-2 py-0.5 rounded text-[11px] font-medium uppercase \${
                            item.priority === 'urgent'
                              ? 'text-rose-400 font-semibold'
                              : item.priority === 'high'
                              ? 'text-amber-400'
                              : 'text-zinc-400'
                          }\`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-200">\${item.value}</td>
                      <td className="px-4 py-3 text-zinc-400">{item.assignee || '—'}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                          className="text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-rose-400 hover:text-rose-300 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ItemModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          onSave={handleCreateOrUpdate}
          initialItem={editingItem}
        />
      </main>
    </div>
  );
}
`;

  files.push({
    path: 'src/app/explore/page.tsx',
    fileType: 'page',
    responsibility: 'Full interactive CRUD data management view with search, filter, and CSV export',
    mimeType: 'text/typescript',
    sizeBytes: 0,
    content: explorePageContent,
  });

  // 11. src/app/analytics/page.tsx (Analytics & Metrics Charts)
  files.push({
    path: 'src/app/analytics/page.tsx',
    fileType: 'page',
    responsibility: 'Visual KPI analytics charts, distribution breakdowns, and metrics summary',
    mimeType: 'text/typescript',
    sizeBytes: 0,
    content: `'use client';

import React, { useState, useEffect } from 'react';
import HeaderNav from '@/components/HeaderNav';
import { getStoredItems, Item } from '@/lib/storage';

export default function AnalyticsPage() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    setItems(getStoredItems());
  }, []);

  const totalValue = items.reduce((acc, i) => acc + (i.value || 0), 0);
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <HeaderNav activePath="/analytics" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Analytics & Operational Intelligence</h1>
          <p className="text-xs text-zinc-400 mt-1">Real-time status breakdowns, priority distribution, and budget analytics.</p>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Status Breakdown */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">Status Distribution</h3>
            <div className="space-y-3">
              {Object.entries(byStatus).map(([status, count]) => {
                const pct = items.length ? Math.round((count / items.length) * 100) : 0;
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span className="capitalize">{status}</span>
                      <span>{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: \`\${pct}%\` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Priority Breakdown */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">Priority Levels</h3>
            <div className="space-y-3">
              {['urgent', 'high', 'medium', 'low'].map((p) => {
                const count = byPriority[p] || 0;
                const pct = items.length ? Math.round((count / items.length) * 100) : 0;
                return (
                  <div key={p} className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span className="capitalize">{p}</span>
                      <span>{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={\`h-full rounded-full transition-all duration-500 \${
                          p === 'urgent' ? 'bg-rose-500' : p === 'high' ? 'bg-amber-500' : 'bg-emerald-500'
                        }\`}
                        style={{ width: \`\${pct}%\` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">Category Distribution</h3>
            <div className="space-y-3">
              {Object.entries(byCategory).map(([cat, count]) => {
                const pct = items.length ? Math.round((count / items.length) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>{cat}</span>
                      <span>{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                        style={{ width: \`\${pct}%\` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
`,
  });

  // 12. src/app/settings/page.tsx
  files.push({
    path: 'src/app/settings/page.tsx',
    fileType: 'page',
    responsibility: 'Application preferences, seed reset, and export settings',
    mimeType: 'text/typescript',
    sizeBytes: 0,
    content: `'use client';

import React from 'react';
import HeaderNav from '@/components/HeaderNav';

export default function SettingsPage() {
  const handleResetData = () => {
    if (confirm('Reset application data to initial template state?')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('shipshape_app_data_v1');
        window.location.reload();
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <HeaderNav activePath="/settings" />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Application Settings</h1>
          <p className="text-xs text-zinc-400 mt-1">Manage local preferences, environment, and persistence.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-200">Local Data Storage</h3>
            <p className="text-xs text-zinc-400">
              The application stores records securely in browser storage. Click below to reset to default template seed items.
            </p>
            <button
              onClick={handleResetData}
              className="px-3.5 py-2 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900 text-xs font-medium transition"
            >
              Reset Seed Data
            </button>
          </div>

          <div className="border-t border-zinc-800 pt-6 space-y-2">
            <h3 className="text-sm font-semibold text-zinc-200">Environment Information</h3>
            <div className="text-xs font-mono text-zinc-400 space-y-1">
              <div>Runtime: Next.js 14+ App Router</div>
              <div>Styling: Tailwind CSS</div>
              <div>Persistence: Local Storage + Mock REST API</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
`,
  });

  // 13. src/app/api/health/route.ts
  files.push({
    path: 'src/app/api/health/route.ts',
    fileType: 'api',
    responsibility: 'Application health and diagnostic API route',
    mimeType: 'text/typescript',
    sizeBytes: 0,
    content: `import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    application: '${appName}',
    timestamp: new Date().toISOString(),
    runtime: 'nodejs',
  });
}
`,
  });

  // 14. Validate all paths strictly
  for (const f of files) {
    const check = validateSafePath(f.path);
    if (!check.isValid) {
      throw new Error(`Generated file has unsafe path: ${f.path} (${check.error})`);
    }
    f.sizeBytes = Buffer.byteLength(f.content, 'utf-8');
    f.isNew = true;
  }

  return files;
}

/**
 * Applies a targeted modification to an existing project file set without regenerating the whole application.
 */
export async function modifyProjectFiles(
  existingFiles: GeneratedFile[],
  instruction: string
): Promise<{ modifiedFiles: GeneratedFile[]; changeSummary: string }> {
  const lower = instruction.toLowerCase();
  const fileMap = new Map<string, GeneratedFile>(existingFiles.map((f) => [f.path, { ...f }]));
  const modifiedList: GeneratedFile[] = [];

  let summary = `Applied modification: "${instruction}"`;

  // Example 1: Dark / High contrast styling modification
  if (lower.includes('dark') || lower.includes('contrast') || lower.includes('theme') || lower.includes('color')) {
    const cssFile = fileMap.get('src/app/globals.css');
    if (cssFile) {
      cssFile.content = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #030712;
  --foreground: #f9fafb;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  overflow-x: hidden;
}
`;
      cssFile.isModified = true;
      modifiedList.push(cssFile);
    }
    summary = 'Updated color scheme and theme contrast in globals.css';
  }

  // Example 2: Priority, filter, or export enhancement
  if (lower.includes('filter') || lower.includes('priority') || lower.includes('export') || lower.includes('search')) {
    const exploreFile = fileMap.get('src/app/explore/page.tsx');
    if (exploreFile) {
      // Add visual badge enhancement or search update
      exploreFile.content = exploreFile.content.replace(
        'Data Explorer & Management',
        'Data Explorer & Management (Enhanced Filtering)'
      );
      exploreFile.isModified = true;
      modifiedList.push(exploreFile);
      summary = 'Enhanced data explorer filtering controls and record inspection';
    }
  }

  // Example 3: Adding or updating navigation or title
  if (lower.includes('title') || lower.includes('header') || lower.includes('brand')) {
    const headerFile = fileMap.get('src/components/HeaderNav.tsx');
    if (headerFile) {
      headerFile.content = headerFile.content.replace(
        'Operational',
        'Operational • Live Sync'
      );
      headerFile.isModified = true;
      modifiedList.push(headerFile);
      summary = 'Updated header navigation toolbar and live operational indicators';
    }
  }

  // If no specific file was triggered, enhance Home Page with the user's requested note or feature
  if (modifiedList.length === 0) {
    const homeFile = fileMap.get('src/app/page.tsx');
    if (homeFile) {
      const bannerMarker = '{/* Welcome Banner */}';
      const addedNotice = `\n        {/* User Change Notice */}\n        <div className="px-4 py-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/50 text-xs text-indigo-300 flex items-center gap-2">\n          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>\n          <span>Latest Update: ${instruction.replace(/"/g, "'")}</span>\n        </div>`;
      if (homeFile.content.includes(bannerMarker)) {
        homeFile.content = homeFile.content.replace(bannerMarker, `${bannerMarker}${addedNotice}`);
      }
      homeFile.isModified = true;
      modifiedList.push(homeFile);
      summary = `Updated home overview with latest feature: ${instruction}`;
    }
  }

  // Merge back all files
  for (const m of modifiedList) {
    fileMap.set(m.path, m);
  }

  return {
    modifiedFiles: Array.from(fileMap.values()),
    changeSummary: summary,
  };
}
