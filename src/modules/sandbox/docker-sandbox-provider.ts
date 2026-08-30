import fs from 'fs/promises';
import path from 'path';
import net from 'net';
import { spawn } from 'child_process';
import { validateSafePath } from '../../server/security/safe-paths.ts';
import type {
  SandboxProvider,
  SandboxHandle,
  CommandSpec,
  CommandResult,
  ProcessSpec,
  ManagedProcessHandle,
} from './sandbox-provider.ts';

export interface DockerRunOptions {
  containerName: string;
  hostPort: number;
  workspaceDir: string;
  image?: string;
  memory?: string;
  cpus?: string;
  pidsLimit?: number;
  user?: string;
  networkMode?: string; // e.g. 'bridge', 'none'
  env?: Record<string, string>;
}

const FORBIDDEN_HOST_ENV_KEYS = new Set([
  'GEMINI_API_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_JWT_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'SECRET_KEY',
]);

/**
 * Docker-based Sandbox Provider implementing the extended SandboxProvider interface.
 * Enforces non-root container execution, zero capability privileges, localhost-only binding,
 * memory/CPU quotas, PID limits, and strict credential isolation.
 */
export class DockerSandboxProvider implements SandboxProvider {
  name = 'docker';
  public sandboxRoot: string;
  public image: string;
  public memoryLimit: string;
  public cpuLimit: string;
  public pidsLimit: number;
  public user: string;

  private activeSandboxes = new Map<string, SandboxHandle>();
  private managedProcesses = new Map<string, ManagedProcessHandle>();
  private snapshots = new Map<string, Record<string, string>>();

  constructor(options?: {
    sandboxRoot?: string;
    image?: string;
    memoryLimit?: string;
    cpuLimit?: string;
    pidsLimit?: number;
    user?: string;
  }) {
    this.sandboxRoot =
      options?.sandboxRoot ||
      process.env.SANDBOX_DIR ||
      path.join(process.cwd(), '.sandboxes');
    this.image =
      options?.image ||
      process.env.SANDBOX_DOCKER_IMAGE ||
      'shipshape-sandbox:node24';
    this.memoryLimit = options?.memoryLimit || process.env.SANDBOX_MEMORY_LIMIT || '2g';
    this.cpuLimit = options?.cpuLimit || process.env.SANDBOX_CPU_LIMIT || '2.0';
    this.pidsLimit =
      options?.pidsLimit ??
      parseInt(process.env.SANDBOX_PIDS_LIMIT || '100', 10);
    this.user = options?.user || process.env.SANDBOX_USER || '1000:1000';
  }

  /**
   * Probes whether the Docker CLI and daemon are reachable on the host system.
   * Returns false without throwing if Docker is missing or unresponsive.
   */
  static async isDockerAvailable(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        const proc = spawn('docker', ['version'], {
          shell: false,
          stdio: 'ignore',
        });

        const timer = setTimeout(() => {
          try {
            proc.kill();
          } catch {
            // Ignore
          }
          resolve(false);
        }, 2000);

        proc.on('error', () => {
          clearTimeout(timer);
          resolve(false);
        });

        proc.on('close', (code) => {
          clearTimeout(timer);
          resolve(code === 0);
        });
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Deterministically constructs docker run arguments with strict isolation parameters.
   * Filters all sensitive builder credentials and locks port binding to 127.0.0.1.
   *
   * Note on Network Security: Binding published ports to 127.0.0.1 restricts inbound host
   * exposure from external networks, but containers retain outbound egress by default.
   * Pass options.networkMode = 'none' to enforce strict outbound isolation after dependency installation.
   */
  static buildRunArgs(options: DockerRunOptions): string[] {
    const memory = options.memory || '2g';
    const cpus = options.cpus || '2.0';
    const pidsLimit = String(options.pidsLimit ?? 100);
    const user = options.user || '1000:1000';
    const image = options.image || 'shipshape-sandbox:node24';

    const args: string[] = [
      'run',
      '-d',
      '--name',
      options.containerName,
      '--user',
      user,
      '--cap-drop=ALL',
      '--security-opt',
      'no-new-privileges',
      '--memory',
      memory,
      '--cpus',
      cpus,
      '--pids-limit',
      pidsLimit,
    ];

    if (options.networkMode) {
      args.push('--network', options.networkMode);
    }

    args.push(
      '-p',
      `127.0.0.1:${options.hostPort}:3000`,
      '-v',
      `${path.resolve(options.workspaceDir)}:/home/node/app`,
      '-w',
      '/home/node/app',
      '-e',
      'NODE_ENV=development',
      '-e',
      'PORT=3000',
      '-e',
      'HOSTNAME=0.0.0.0'
    );

    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        if (!FORBIDDEN_HOST_ENV_KEYS.has(key)) {
          args.push('-e', `${key}=${value}`);
        }
      }
    }

    args.push(image, 'node', '-e', 'setInterval(() => {}, 1000)');
    return args;
  }

  /**
   * Dynamically allocates an available TCP port on the loopback interface (127.0.0.1).
   */
  static async allocateLocalPort(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          const port = addr.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => reject(new Error('Failed to obtain port from ephemeral loopback server')));
        }
      });
    });
  }

  async create(projectId: string): Promise<SandboxHandle> {
    const dockerAvailable = await DockerSandboxProvider.isDockerAvailable();
    if (!dockerAvailable) {
      throw new Error(
        'Docker execution engine requested, but Docker is not available on host. Docker CLI or daemon could not be reached.'
      );
    }

    const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const containerName = `shipshape-sbx-${safeProjectId}-${Date.now()}`;
    const workspaceDir = path.resolve(this.sandboxRoot, containerName);
    await fs.mkdir(workspaceDir, { recursive: true });

    const hostPort = await DockerSandboxProvider.allocateLocalPort();

    const runArgs = DockerSandboxProvider.buildRunArgs({
      containerName,
      hostPort,
      workspaceDir,
      image: this.image,
      memory: this.memoryLimit,
      cpus: this.cpuLimit,
      pidsLimit: this.pidsLimit,
      user: this.user,
    });

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('docker', runArgs, { shell: false });
      let stderr = '';

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to create docker container: ${stderr || `exit code ${code}`}`));
        }
      });
    });

    const handle: SandboxHandle = {
      id: containerName,
      projectId,
      provider: 'docker',
      workspaceDir,
      containerId: containerName,
      previewUrl: `http://127.0.0.1:${hostPort}`,
      hostPort,
      status: 'running',
      createdAt: new Date().toISOString(),
    };

    this.activeSandboxes.set(containerName, handle);
    return handle;
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

  async runCommand(
    sandbox: SandboxHandle,
    command: string | CommandSpec,
    timeoutMs = 60000
  ): Promise<CommandResult> {
    const startTime = Date.now();
    let executable: string;
    let args: string[] = [];
    let cmdTimeout = timeoutMs;
    const env: Record<string, string> = {};

    if (typeof command === 'string') {
      const parts = command.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) {
        return {
          stdout: '',
          stderr: 'Empty command provided',
          exitCode: 1,
          durationMs: 0,
        };
      }
      executable = parts[0];
      args = parts.slice(1);
    } else {
      executable = command.executable;
      args = command.args;
      cmdTimeout = command.timeoutMs || timeoutMs;
      if (command.env) {
        for (const [k, v] of Object.entries(command.env)) {
          if (!FORBIDDEN_HOST_ENV_KEYS.has(k)) {
            env[k] = v;
          }
        }
      }
    }

    const execArgs: string[] = [
      'exec',
      '-i',
      '-w',
      (typeof command === 'object' && command.cwd) || '/home/node/app',
    ];
    for (const [k, v] of Object.entries(env)) {
      execArgs.push('-e', `${k}=${v}`);
    }
    execArgs.push(sandbox.containerId || sandbox.id, executable, ...args);

    return new Promise<CommandResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn('docker', execArgs, { shell: false });

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill();
        } catch {
          // Ignore
        }
      }, cmdTimeout);

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: stderr || err.message,
          exitCode: 1,
          durationMs: Date.now() - startTime,
          timedOut,
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: timedOut ? 124 : (code ?? 0),
          durationMs: Date.now() - startTime,
          timedOut,
        });
      });
    });
  }

  async startProcess(sandbox: SandboxHandle, spec: ProcessSpec): Promise<ManagedProcessHandle> {
    const processId = `proc_${sandbox.projectId}_${Date.now()}`;
    const execArgs: string[] = ['exec', '-d', '-w', spec.cwd || '/home/node/app'];

    if (spec.env) {
      for (const [k, v] of Object.entries(spec.env)) {
        if (!FORBIDDEN_HOST_ENV_KEYS.has(k)) {
          execArgs.push('-e', `${k}=${v}`);
        }
      }
    }

    execArgs.push(sandbox.containerId || sandbox.id, spec.executable, ...spec.args);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('docker', execArgs, { shell: false });
      let stderr = '';

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to start process "${spec.name}": ${stderr || `exit code ${code}`}`));
        }
      });
    });

    const handle: ManagedProcessHandle = {
      id: processId,
      name: spec.name,
      port: sandbox.hostPort,
      previewUrl: sandbox.previewUrl,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    this.managedProcesses.set(processId, handle);
    return handle;
  }

  async waitForReady(
    sandbox: SandboxHandle,
    _handle: ManagedProcessHandle,
    timeoutMs = 30000
  ): Promise<boolean> {
    const startTime = Date.now();
    const readyUrl = sandbox.previewUrl;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const res = await fetch(readyUrl, {
          signal: AbortSignal.timeout(1000),
        });
        if (res.status < 500) {
          return true;
        }
      } catch {
        // Retry polling
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    return false;
  }

  async getProcessLogs(
    sandbox: SandboxHandle,
    _handle: ManagedProcessHandle,
    maxLines = 100
  ): Promise<string[]> {
    return new Promise<string[]>((resolve) => {
      const proc = spawn('docker', ['logs', '--tail', String(maxLines), sandbox.containerId || sandbox.id], {
        shell: false,
      });

      let output = '';
      proc.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });
      proc.stderr.on('data', (chunk) => {
        output += chunk.toString();
      });

      proc.on('error', () => resolve([]));
      proc.on('close', () => {
        const lines = output
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        resolve(lines.slice(-maxLines));
      });
    });
  }

  async stopProcess(_sandbox: SandboxHandle, handle: ManagedProcessHandle): Promise<void> {
    handle.status = 'stopped';
  }

  async getPreviewUrl(sandbox: SandboxHandle): Promise<string> {
    return sandbox.previewUrl;
  }

  /**
   * Captures the source snapshot independent of container identity.
   * Reads the current filesystem state in the workspace directory.
   */
  async snapshot(sandbox: SandboxHandle): Promise<string> {
    if (!sandbox.workspaceDir) {
      throw new Error(`Cannot snapshot sandbox ${sandbox.id} without workspaceDir`);
    }

    const snapshotId = `snap_docker_${sandbox.projectId}_${Date.now()}`;
    const files = await this.readWorkspaceFiles(sandbox.workspaceDir);
    this.snapshots.set(snapshotId, files);
    return snapshotId;
  }

  /**
   * Restores snapshot files into the sandbox workspace directory.
   */
  async restore(sandbox: SandboxHandle, snapshotId: string): Promise<void> {
    const files = this.snapshots.get(snapshotId);
    if (!files) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    await this.writeFiles(sandbox, files);
  }

  async stop(sandbox: SandboxHandle): Promise<void> {
    sandbox.status = 'stopped';
    const containerId = sandbox.containerId || sandbox.id;

    await new Promise<void>((resolve) => {
      const proc = spawn('docker', ['stop', '-t', '2', containerId], {
        shell: false,
        stdio: 'ignore',
      });
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
    });

    await new Promise<void>((resolve) => {
      const proc = spawn('docker', ['rm', '-f', containerId], {
        shell: false,
        stdio: 'ignore',
      });
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
    });

    if (sandbox.workspaceDir) {
      try {
        await fs.rm(sandbox.workspaceDir, { recursive: true, force: true });
      } catch {
        // Ephemeral cleanup best-effort
      }
    }

    this.activeSandboxes.delete(containerId);
  }

  private async readWorkspaceFiles(dir: string, baseDir: string = dir): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(baseDir, full);
        if (entry.isDirectory()) {
          if (['.git', 'node_modules', '.next', '.sandboxes'].includes(entry.name)) {
            continue;
          }
          Object.assign(result, await this.readWorkspaceFiles(full, baseDir));
        } else if (entry.isFile()) {
          try {
            result[rel] = await fs.readFile(full, 'utf-8');
          } catch {
            // Ignore unreadable files
          }
        }
      }
    } catch {
      // Ignore if dir cannot be read
    }
    return result;
  }
}

