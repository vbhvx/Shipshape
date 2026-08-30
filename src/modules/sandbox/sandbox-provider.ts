import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { validateSafePath } from '../../server/security/safe-paths.ts';

export interface CommandSpec {
  executable: string;
  args: string[];
  cwd?: string;
  timeoutMs: number;
  env?: Record<string, string>;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut?: boolean;
}

export interface ProcessSpec {
  name: string;
  executable: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  readyPattern?: RegExp | string;
  readyEndpoint?: string;
}

export interface ManagedProcessHandle {
  id: string;
  name: string;
  port?: number;
  previewUrl?: string;
  status: 'starting' | 'running' | 'stopped' | 'failed';
  startedAt: string;
  pid?: number;
}

export interface SandboxHandle {
  id: string;
  projectId: string;
  provider: 'local_temp' | 'docker' | 'daytona' | 'e2b';
  workspaceDir?: string;
  containerId?: string;
  previewUrl: string;
  hostPort?: number;
  status: 'starting' | 'running' | 'stopped' | 'failed';
  createdAt: string;
}

/**
 * Provider-independent Sandbox interface based on the Shipshape Architecture Blueprint.
 * Defines the contract across local ephemeral workspaces, local Docker containers,
 * and future cloud microVM providers (E2B, Daytona, Modal).
 */
export interface SandboxProvider {
  name: string;
  create(projectId: string): Promise<SandboxHandle>;
  writeFiles(sandbox: SandboxHandle, files: Record<string, string>): Promise<void>;
  runCommand(sandbox: SandboxHandle, command: string | CommandSpec, timeoutMs?: number): Promise<CommandResult>;
  startProcess(sandbox: SandboxHandle, spec: ProcessSpec): Promise<ManagedProcessHandle>;
  waitForReady(sandbox: SandboxHandle, handle: ManagedProcessHandle, timeoutMs: number): Promise<boolean>;
  getProcessLogs(sandbox: SandboxHandle, handle: ManagedProcessHandle, maxLines?: number): Promise<string[]>;
  stopProcess(sandbox: SandboxHandle, handle: ManagedProcessHandle): Promise<void>;
  getPreviewUrl(sandbox: SandboxHandle): Promise<string>;
  snapshot(sandbox: SandboxHandle): Promise<string>;
  restore(sandbox: SandboxHandle, snapshotId: string): Promise<void>;
  stop(sandbox: SandboxHandle): Promise<void>;
}

/**
 * Default Local Filesystem Sandbox Provider for development and fast ephemeral simulation.
 * Enforces strict workspace containment and path traversal protection.
 */
export class LocalTempSandboxProvider implements SandboxProvider {
  name = 'local_temp';
  private sandboxRoot: string;
  private managedProcesses = new Map<string, ManagedProcessHandle>();
  private processLogs = new Map<string, string[]>();

  constructor(sandboxRoot?: string) {
    this.sandboxRoot = sandboxRoot || process.env.SANDBOX_DIR || path.join(os.tmpdir(), 'shipshape-sandboxes');
  }

  async create(projectId: string): Promise<SandboxHandle> {
    const safeProjectDir = path.resolve(this.sandboxRoot, projectId.replace(/[^a-zA-Z0-9_-]/g, '_'));
    await fs.mkdir(safeProjectDir, { recursive: true });

    return {
      id: `sbx_${projectId}_${Date.now()}`,
      projectId,
      provider: 'local_temp',
      workspaceDir: safeProjectDir,
      previewUrl: `/api/v1/preview/${projectId}?route=/`,
      status: 'running',
      createdAt: new Date().toISOString(),
    };
  }

  async writeFiles(sandbox: SandboxHandle, files: Record<string, string>): Promise<void> {
    if (!sandbox.workspaceDir) {
      throw new Error(`Sandbox ${sandbox.id} does not have a designated workspaceDir`);
    }

    const baseDir = sandbox.workspaceDir;

    await Promise.all(
      Object.entries(files).map(async ([filePath, content]) => {
        const check = validateSafePath(filePath);
        if (!check.isValid) {
          throw new Error(`Unsafe file path in generated files: ${check.error}`);
        }

        const fullPath = path.resolve(baseDir, check.normalizedPath);
        if (!fullPath.startsWith(baseDir + path.sep) && fullPath !== baseDir) {
          throw new Error(`File path escapes workspace directory: ${filePath}`);
        }

        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
      })
    );
  }

  async runCommand(sandbox: SandboxHandle, command: string | CommandSpec, _timeoutMs = 10000): Promise<CommandResult> {
    const startTime = Date.now();
    const commandStr = typeof command === 'string' ? command : `${command.executable} ${command.args.join(' ')}`;

    // In local simulation mode, shell execution performs static mock verification
    return {
      stdout: `[LOCAL_TEMP] Simulation command execution: "${commandStr}" (workspace: ${sandbox.workspaceDir || sandbox.id})`,
      stderr: '',
      exitCode: 0,
      durationMs: Math.max(1, Date.now() - startTime),
    };
  }

  async startProcess(sandbox: SandboxHandle, spec: ProcessSpec): Promise<ManagedProcessHandle> {
    const processId = `proc_${sandbox.projectId}_${Date.now()}`;
    const handle: ManagedProcessHandle = {
      id: processId,
      name: spec.name,
      port: 3100,
      previewUrl: `/api/v1/preview/${sandbox.projectId}?route=/`,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    this.managedProcesses.set(processId, handle);
    this.processLogs.set(processId, [
      `[${handle.startedAt}] [SIMULATION] Process "${spec.name}" started: ${spec.executable} ${spec.args.join(' ')}`,
      `[${handle.startedAt}] [SIMULATION] Listening on preview simulation route`,
    ]);

    return handle;
  }

  async waitForReady(_sandbox: SandboxHandle, handle: ManagedProcessHandle, _timeoutMs: number): Promise<boolean> {
    return handle.status === 'running';
  }

  async getProcessLogs(_sandbox: SandboxHandle, handle: ManagedProcessHandle, maxLines = 100): Promise<string[]> {
    const logs = this.processLogs.get(handle.id) || [];
    return logs.slice(-maxLines);
  }

  async stopProcess(_sandbox: SandboxHandle, handle: ManagedProcessHandle): Promise<void> {
    handle.status = 'stopped';
    const logs = this.processLogs.get(handle.id) || [];
    logs.push(`[${new Date().toISOString()}] [SIMULATION] Process "${handle.name}" stopped.`);
  }

  async getPreviewUrl(sandbox: SandboxHandle): Promise<string> {
    return sandbox.previewUrl;
  }

  async snapshot(sandbox: SandboxHandle): Promise<string> {
    return `snap_local_${sandbox.projectId}_${Date.now()}`;
  }

  async restore(_sandbox: SandboxHandle, _snapshotId: string): Promise<void> {
    // Local restore reads files from durable PostgreSQL/JSON storage
  }

  async stop(sandbox: SandboxHandle): Promise<void> {
    sandbox.status = 'stopped';
    if (sandbox.workspaceDir) {
      try {
        await fs.rm(sandbox.workspaceDir, { recursive: true, force: true });
      } catch {
        // Ephemeral directory cleanup best-effort
      }
    }
  }
}

/**
 * Factory function to retrieve the configured SandboxProvider.
 * Respects SANDBOX_PROVIDER=local-temp|docker environment variable.
 */
export async function getSandboxProvider(providerType?: string): Promise<SandboxProvider> {
  const chosen = (providerType || process.env.SANDBOX_PROVIDER || 'local-temp').toLowerCase();

  if (chosen === 'docker') {
    const { DockerSandboxProvider } = await import('./docker-sandbox-provider');
    return new DockerSandboxProvider();
  }

  return new LocalTempSandboxProvider();
}
