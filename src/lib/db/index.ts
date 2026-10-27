import fs from 'fs/promises';
import path from 'path';
import {
  User,
  Project,
  ProjectSpecification,
  ProjectVersion,
  GeneratedFile,
  GenerationRun,
  GenerationEvent,
  SandboxSession,
  PreviewSession,
  BuildCheckResult,
  BuildLog,
} from '@/types';

interface DatabaseStore {
  users: Record<string, User>;
  projects: Record<string, Project>;
  specifications: Record<string, ProjectSpecification>;
  versions: Record<string, ProjectVersion>;
  files: Record<string, GeneratedFile & { projectId: string; versionId: string }>;
  generationRuns: Record<string, GenerationRun>;
  generationEvents: Record<string, GenerationEvent[]>;
  sandboxSessions: Record<string, SandboxSession>;
  previewSessions: Record<string, PreviewSession>;
  buildResults: Record<string, BuildCheckResult[]>;
  buildLogs: Record<string, BuildLog[]>;
  auditEvents: Record<string, any[]>;
  idempotency: Record<string, any>;
}

const DATA_DIR = path.join(process.cwd(), '.shipshape-data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// In-memory cache for ultra-fast queries
let storeCache: DatabaseStore | null = null;
let isInitializing = false;

// Default demo user
const DEFAULT_USER: User = {
  id: 'usr_default_builder',
  email: 'builder@shipshape.ai',
  name: 'Alex Rivera',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

let lastMtime = 0;

async function ensureDataStore(): Promise<DatabaseStore> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const stat = await fs.stat(DATA_FILE);
      if (storeCache && stat.mtimeMs <= lastMtime) {
        return storeCache;
      }
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      storeCache = JSON.parse(data) as DatabaseStore;
      lastMtime = stat.mtimeMs;
      return storeCache;
    } catch {
      // Initialize with default structure
      storeCache = {
        users: { [DEFAULT_USER.id]: DEFAULT_USER },
        projects: {},
        specifications: {},
        versions: {},
        files: {},
        generationRuns: {},
        generationEvents: {},
        sandboxSessions: {},
        previewSessions: {},
        buildResults: {},
        buildLogs: {},
        auditEvents: {},
        idempotency: {},
      };
      await saveStore(storeCache);
    }
  } finally {
    isInitializing = false;
  }

  return storeCache;
}

async function saveStore(store: DatabaseStore): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${DATA_FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(store, null, 2), 'utf-8');
    await fs.rename(tempFile, DATA_FILE);
    const stat = await fs.stat(DATA_FILE);
    lastMtime = stat.mtimeMs;
  } catch (err) {
    console.error('Failed to persist Shipshape store:', err);
  }
}

export const db = {
  // Users
  async getUser(id: string): Promise<User | null> {
    const s = await ensureDataStore();
    return s.users[id] || null;
  },

  async getDefaultUser(): Promise<User> {
    const s = await ensureDataStore();
    if (!s.users[DEFAULT_USER.id]) {
      s.users[DEFAULT_USER.id] = DEFAULT_USER;
      await saveStore(s);
    }
    return s.users[DEFAULT_USER.id];
  },

  // Projects
  async listProjects(userId: string): Promise<Project[]> {
    const s = await ensureDataStore();
    return Object.values(s.projects)
      .filter((p) => p.ownerUserId === userId && !p.archivedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async getProject(id: string): Promise<Project | null> {
    const s = await ensureDataStore();
    return s.projects[id] || null;
  },

  async createProject(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    const s = await ensureDataStore();
    const now = new Date().toISOString();
    const newProject: Project = {
      ...project,
      createdAt: now,
      updatedAt: now,
    };
    s.projects[newProject.id] = newProject;
    await saveStore(s);
    return newProject;
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    const s = await ensureDataStore();
    const existing = s.projects[id];
    if (!existing) return null;
    const updated: Project = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    s.projects[id] = updated;
    await saveStore(s);
    return updated;
  },

  async deleteProject(id: string): Promise<boolean> {
    const s = await ensureDataStore();
    if (!s.projects[id]) return false;
    s.projects[id].archivedAt = new Date().toISOString();
    await saveStore(s);
    return true;
  },

  // Specifications
  async getSpecification(projectId: string): Promise<ProjectSpecification | null> {
    const s = await ensureDataStore();
    return s.specifications[projectId] || null;
  },

  async saveSpecification(spec: ProjectSpecification): Promise<ProjectSpecification> {
    const s = await ensureDataStore();
    s.specifications[spec.projectId] = spec;
    await saveStore(s);
    return spec;
  },

  // Versions
  async listVersions(projectId: string): Promise<ProjectVersion[]> {
    const s = await ensureDataStore();
    return Object.values(s.versions)
      .filter((v) => v.projectId === projectId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  },

  async getVersion(versionId: string): Promise<ProjectVersion | null> {
    const s = await ensureDataStore();
    return s.versions[versionId] || null;
  },

  async saveVersion(version: ProjectVersion): Promise<ProjectVersion> {
    const s = await ensureDataStore();
    s.versions[version.id] = version;
    await saveStore(s);
    return version;
  },

  // Project Files
  async getFilesForVersion(projectId: string, versionId: string): Promise<GeneratedFile[]> {
    const s = await ensureDataStore();
    return Object.values(s.files)
      .filter((f) => f.projectId === projectId && f.versionId === versionId)
      .map(({ projectId: _, versionId: __, ...file }) => file);
  },

  async getFile(projectId: string, versionId: string, filePath: string): Promise<GeneratedFile | null> {
    const s = await ensureDataStore();
    const key = `${projectId}:${versionId}:${filePath}`;
    const f = s.files[key];
    if (!f) return null;
    const { projectId: _, versionId: __, ...file } = f;
    return file;
  },

  async saveFiles(projectId: string, versionId: string, files: GeneratedFile[]): Promise<void> {
    const s = await ensureDataStore();
    for (const f of files) {
      const key = `${projectId}:${versionId}:${f.path}`;
      s.files[key] = {
        ...f,
        projectId,
        versionId,
      };
    }
    await saveStore(s);
  },

  // Generation Runs
  async getGenerationRun(runId: string): Promise<GenerationRun | null> {
    const s = await ensureDataStore();
    return s.generationRuns[runId] || null;
  },

  async saveGenerationRun(run: GenerationRun): Promise<GenerationRun> {
    const s = await ensureDataStore();
    s.generationRuns[run.id] = run;
    await saveStore(s);
    return run;
  },

  async updateGenerationRun(runId: string, updates: Partial<GenerationRun>): Promise<GenerationRun | null> {
    const s = await ensureDataStore();
    const existing = s.generationRuns[runId];
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    s.generationRuns[runId] = updated;
    await saveStore(s);
    return updated;
  },

  // Generation Events
  async addGenerationEvent(runId: string, event: Omit<GenerationEvent, 'id' | 'createdAt'>): Promise<GenerationEvent> {
    const s = await ensureDataStore();
    if (!s.generationEvents[runId]) {
      s.generationEvents[runId] = [];
    }
    const fullEvent: GenerationEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    s.generationEvents[runId].push(fullEvent);
    await saveStore(s);
    return fullEvent;
  },

  async getGenerationEvents(runId: string): Promise<GenerationEvent[]> {
    const s = await ensureDataStore();
    return s.generationEvents[runId] || [];
  },

  // Sandbox Sessions
  async getSandboxSession(projectId: string): Promise<SandboxSession | null> {
    const s = await ensureDataStore();
    return s.sandboxSessions[projectId] || null;
  },

  async saveSandboxSession(session: SandboxSession): Promise<SandboxSession> {
    const s = await ensureDataStore();
    s.sandboxSessions[session.projectId] = session;
    await saveStore(s);
    return session;
  },

  // Build Results & Logs
  async saveBuildResults(runId: string, results: BuildCheckResult[]): Promise<void> {
    const s = await ensureDataStore();
    s.buildResults[runId] = results;
    await saveStore(s);
  },

  async getBuildResults(runId: string): Promise<BuildCheckResult[]> {
    const s = await ensureDataStore();
    return s.buildResults[runId] || [];
  },

  async addBuildLog(runId: string, streamType: 'stdout' | 'stderr' | 'system', content: string): Promise<void> {
    const s = await ensureDataStore();
    if (!s.buildLogs[runId]) {
      s.buildLogs[runId] = [];
    }
    s.buildLogs[runId].push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      generationRunId: runId,
      streamType,
      content,
      timestamp: new Date().toISOString(),
    });
    // Cap in-memory logs to latest 1000 lines
    if (s.buildLogs[runId].length > 1000) {
      s.buildLogs[runId] = s.buildLogs[runId].slice(-1000);
    }
    await saveStore(s);
  },

  async getBuildLogs(runId: string): Promise<BuildLog[]> {
    const s = await ensureDataStore();
    return s.buildLogs[runId] || [];
  },

  // Audit Events
  async recordAudit(action: string, projectId?: string, userId?: string, metadata?: any): Promise<void> {
    const s = await ensureDataStore();
    const event = {
      id: `audit_${Date.now()}`,
      action,
      projectId,
      userId,
      metadata,
      createdAt: new Date().toISOString(),
    };
    if (projectId) {
      if (!s.auditEvents[projectId]) s.auditEvents[projectId] = [];
      s.auditEvents[projectId].push(event);
    }
    await saveStore(s);
  },
};
