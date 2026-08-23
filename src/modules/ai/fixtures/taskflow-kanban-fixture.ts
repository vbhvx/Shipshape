import type { ModelFixture } from './saas-landing-fixture';

/**
 * Fixture: TaskFlow Kanban Task Management App (bench_04_task_management)
 * Interactive Kanban application with client-side localStorage persistence that
 * survives page reloads, responsive layout, task creation, movement, and deletion.
 */
export const TASKFLOW_KANBAN_FIXTURE: ModelFixture = {
  id: 'fixture_taskflow_kanban_v1',
  name: 'TaskFlow Kanban Management App Fixture',
  description: 'Recorded model synthesis for full-featured interactive Kanban board with reload persistence',
  scenarioId: 'bench_04_task_management',
  version: '1.0.0',
  summary: 'Synthesized 3-column Kanban application with task creation, priority tagging, and localStorage state survival',
  usageMetadata: {
    promptTokens: 920,
    candidatesTokens: 6100,
    totalTokens: 7020,
    durationMs: 4800,
  },
  files: [
    {
      path: 'package.json',
      responsibility: 'Application dependencies and scripts',
      fileType: 'config',
      content: JSON.stringify(
        {
          name: 'taskflow-kanban-app',
          version: '1.0.0',
          private: true,
          scripts: {
            build: 'next build',
            start: 'next start -p 3000 -H 0.0.0.0',
          },
          dependencies: {
            next: '^16.4.3',
            react: '^19.3.0',
            'react-dom': '^19.3.0',
            'lucide-react': '^1.61.0',
          },
          devDependencies: {
            typescript: '^5.4.0',
            '@types/node': '^22.0.0',
            '@types/react': '^19',
            '@types/react-dom': '^19',
          },
        },
        null,
        2
      ),
    },
    {
      path: 'tsconfig.json',
      responsibility: 'TypeScript compiler configuration',
      fileType: 'config',
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
            jsx: 'react-jsx',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./src/*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
          exclude: ['node_modules'],
        },
        null,
        2
      ),
    },
    {
      path: 'next.config.mjs',
      responsibility: 'Turbopack root resolution configuration',
      fileType: 'config',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: '/home/node',
  },
};
export default nextConfig;\n`,
    },
    {
      path: 'src/app/globals.css',
      responsibility: 'Global styling and overflow protection',
      fileType: 'style',
      content: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          width: 100%;
          overflow-x: hidden;
          background: #0f172a;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
      `,
    },
    {
      path: 'src/app/layout.tsx',
      responsibility: 'Root application layout',
      fileType: 'layout',
      content: `
        import './globals.css';
        export const metadata = {
          title: 'TaskFlow — Interactive Kanban Board',
          description: 'Streamlined task management and workflow coordination with persistent local state',
        };

        export default function RootLayout({ children }: { children: React.ReactNode }) {
          return (
            <html lang="en">
              <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
              </head>
              <body style={{ margin: 0, padding: 0, overflowX: 'hidden', background: '#0f172a', color: '#f8fafc' }}>
                {children}
              </body>
            </html>
          );
        }
      `,
    },
    {
      path: 'src/lib/storage.ts',
      responsibility: 'Strongly-typed local storage manager with reload persistence',
      fileType: 'lib',
      content: `
        export interface TaskItem {
          id: string;
          title: string;
          description?: string;
          priority: 'Low' | 'Medium' | 'High';
          status: 'todo' | 'in_progress' | 'done';
          createdAt: string;
        }

        const STORAGE_KEY = 'taskflow_tasks_v1';

        const SEED_TASKS: TaskItem[] = [
          {
            id: 'task-1',
            title: 'Design high-converting SaaS landing page',
            description: 'Define hero section, 3-tier pricing matrix, and responsive viewports',
            priority: 'High',
            status: 'done',
            createdAt: '2026-10-30T10:00:00Z',
          },
          {
            id: 'task-2',
            title: 'Implement Docker sandbox runtime provider',
            description: 'Enforce non-root execution, 2GB memory quotas, and loopback binding',
            priority: 'High',
            status: 'in_progress',
            createdAt: '2026-10-30T11:00:00Z',
          },
          {
            id: 'task-3',
            title: 'Execute automated Playwright reload persistence tests',
            description: 'Verify state survives full page.reload without loss',
            priority: 'Medium',
            status: 'todo',
            createdAt: '2026-10-30T12:00:00Z',
          },
        ];

        export function getStoredTasks(): TaskItem[] {
          if (typeof window === 'undefined') {
            return SEED_TASKS;
          }
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_TASKS));
              return SEED_TASKS;
            }
            return JSON.parse(raw);
          } catch {
            return SEED_TASKS;
          }
        }

        export function saveStoredTasks(tasks: TaskItem[]): void {
          if (typeof window === 'undefined') return;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
          } catch {}
        }
      `,
    },
    {
      path: 'src/app/page.tsx',
      responsibility: 'Interactive Kanban board page with task creation, moving, and deletion',
      fileType: 'page',
      content: `
        'use client';
        import React, { useState, useEffect } from 'react';
        import { getStoredTasks, saveStoredTasks, type TaskItem } from '../lib/storage';

        export default function Page() {
          const [tasks, setTasks] = useState<TaskItem[]>([]);
          const [newTaskTitle, setNewTaskTitle] = useState('');
          const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
          const [filterPriority, setFilterPriority] = useState<string>('All');
          const [isHydrated, setIsHydrated] = useState(false);

          useEffect(() => {
            const loaded = getStoredTasks();
            setTasks(loaded);
            setIsHydrated(true);
          }, []);

          const updateAndPersist = (updated: TaskItem[]) => {
            setTasks(updated);
            saveStoredTasks(updated);
          };

          const handleAddTask = (e: React.FormEvent) => {
            e.preventDefault();
            if (!newTaskTitle.trim()) return;

            const newTask: TaskItem = {
              id: 'task-' + Date.now(),
              title: newTaskTitle.trim(),
              priority: newTaskPriority,
              status: 'todo',
              createdAt: new Date().toISOString(),
            };

            const updated = [newTask, ...tasks];
            updateAndPersist(updated);
            setNewTaskTitle('');
          };

          const handleMoveTask = (taskId: string, targetStatus: 'todo' | 'in_progress' | 'done') => {
            const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t));
            updateAndPersist(updated);
          };

          const handleDeleteTask = (taskId: string) => {
            const updated = tasks.filter((t) => t.id !== taskId);
            updateAndPersist(updated);
          };

          const filteredTasks = tasks.filter((t) => filterPriority === 'All' || t.priority === filterPriority);

          const columns: Array<{ id: 'todo' | 'in_progress' | 'done'; title: string; color: string }> = [
            { id: 'todo', title: 'To Do', color: '#64748b' },
            { id: 'in_progress', title: 'In Progress', color: '#38bdf8' },
            { id: 'done', title: 'Done', color: '#22c55e' },
          ];

          return (
            <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%', overflowX: 'hidden' }}>
              {/* Header */}
              <header
                role="banner"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 24px',
                  background: '#1e293b',
                  borderBottom: '1px solid #334155',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#38bdf8' }} />
                  <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>TaskFlow Kanban</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>Filter:</span>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    style={{
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    <option value="All">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </header>

              {/* Task Creation Form */}
              <section style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <form
                  onSubmit={handleAddTask}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    background: '#1e293b',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Enter new task title..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    style={{
                      flex: '1 1 240px',
                      padding: '10px 14px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '14px',
                    }}
                  />
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    style={{
                      padding: '10px 14px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '14px',
                    }}
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                  <button
                    type="submit"
                    style={{
                      padding: '10px 20px',
                      background: '#38bdf8',
                      color: '#0f172a',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    Add Task
                  </button>
                </form>
              </section>

              {/* 3-Column Kanban Board */}
              <section
                style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                  padding: '0 24px 32px',
                  maxWidth: '1200px',
                  margin: '0 auto',
                  width: '100%',
                }}
              >
                {columns.map((col) => {
                  const colTasks = filteredTasks.filter((t) => t.status === col.id);
                  return (
                    <div
                      key={col.id}
                      data-testid={'kanban-column-' + col.id}
                      style={{
                        background: '#1e293b',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #334155',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#0f172a',
                        }}
                      >
                        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                          {col.title}
                        </h2>
                        <span style={{ fontSize: '12px', background: '#334155', padding: '2px 8px', borderRadius: '12px', color: '#94a3b8' }}>
                          {colTasks.length}
                        </span>
                      </div>

                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        {colTasks.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '13px' }}>
                            No tasks in this column
                          </div>
                        ) : (
                          colTasks.map((task) => (
                            <div
                              key={task.id}
                              data-testid="taskflow-task-card"
                              style={{
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '6px',
                                padding: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>{task.title}</span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background:
                                      task.priority === 'High'
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : task.priority === 'Medium'
                                        ? 'rgba(245, 158, 11, 0.2)'
                                        : 'rgba(59, 130, 246, 0.2)',
                                    color:
                                      task.priority === 'High'
                                        ? '#ef4444'
                                        : task.priority === 'Medium'
                                        ? '#f59e0b'
                                        : '#3b82f6',
                                  }}
                                >
                                  {task.priority}
                                </span>
                              </div>
                              {task.description && (
                                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>{task.description}</p>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {col.id !== 'todo' && (
                                    <button
                                      onClick={() => handleMoveTask(task.id, col.id === 'done' ? 'in_progress' : 'todo')}
                                      style={{
                                        background: '#334155',
                                        color: '#cbd5e1',
                                        border: 'none',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      ← Back
                                    </button>
                                  )}
                                  {col.id !== 'done' && (
                                    <button
                                      onClick={() => handleMoveTask(task.id, col.id === 'todo' ? 'in_progress' : 'done')}
                                      style={{
                                        background: '#38bdf8',
                                        color: '#0f172a',
                                        border: 'none',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Advance →
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  style={{
                                    background: 'transparent',
                                    color: '#ef4444',
                                    border: 'none',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                  }}
                                  title="Delete task"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>

              {/* Status footer */}
              <footer style={{ borderTop: '1px solid #334155', padding: '16px 24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                <span data-testid="storage-status">
                  {isHydrated ? '● LocalStorage State Active' : '○ Hydrating State...'}
                </span>
                {' · TaskFlow Productivity Engine'}
              </footer>
            </main>
          );
        }
      `,
    },
  ],
};

