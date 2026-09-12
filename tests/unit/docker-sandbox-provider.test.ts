import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { DockerSandboxProvider } from '@/modules/sandbox/docker-sandbox-provider';
import { getSandboxProvider, LocalTempSandboxProvider } from '@/modules/sandbox/sandbox-provider';

describe('DockerSandboxProvider Unit Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-docker-sbx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('initializes with default security and resource quota values', () => {
    const provider = new DockerSandboxProvider({ sandboxRoot: tempDir });
    expect(provider.name).toBe('docker');
    expect(provider.memoryLimit).toBe('2g');
    expect(provider.cpuLimit).toBe('2.0');
    expect(provider.pidsLimit).toBe(100);
    expect(provider.user).toBe('1000:1000');
    expect(provider.image).toBe('shipshape-sandbox:node24');
  });

  it('deterministically formats container run arguments with full security hardening', () => {
    const args = DockerSandboxProvider.buildRunArgs({
      containerName: 'shipshape-sbx-test-123',
      hostPort: 34567,
      workspaceDir: tempDir,
      memory: '2g',
      cpus: '2.0',
      pidsLimit: 100,
      user: '1000:1000',
    });

    // Enforce container name and non-root execution
    expect(args).toContain('--name');
    expect(args).toContain('shipshape-sbx-test-123');
    expect(args).toContain('--user');
    expect(args).toContain('1000:1000');

    // Enforce capability drop and privilege escalation protection
    expect(args).toContain('--cap-drop=ALL');
    expect(args).toContain('--security-opt');
    expect(args).toContain('no-new-privileges');

    // Enforce resource quotas
    expect(args).toContain('--memory');
    expect(args).toContain('2g');
    expect(args).toContain('--cpus');
    expect(args).toContain('2.0');
    expect(args).toContain('--pids-limit');
    expect(args).toContain('100');

    // Enforce strict loopback port binding (never 0.0.0.0 or unrestricted)
    expect(args).toContain('-p');
    expect(args).toContain('127.0.0.1:34567:3000');
    expect(args.some((a) => a.includes('0.0.0.0:34567'))).toBe(false);

    // Enforce workspace mount containment
    expect(args).toContain('-v');
    expect(args).toContain(`${path.resolve(tempDir)}:/home/node/app`);
    expect(args).toContain('-w');
    expect(args).toContain('/home/node/app');
  });

  it('supports strict outbound network isolation via networkMode option', () => {
    const args = DockerSandboxProvider.buildRunArgs({
      containerName: 'shipshape-sbx-isolated-net',
      hostPort: 34568,
      workspaceDir: tempDir,
      networkMode: 'none',
    });

    expect(args).toContain('--network');
    expect(args).toContain('none');
  });

  it('strictly filters out sensitive host builder secrets from container environment', () => {
    const args = DockerSandboxProvider.buildRunArgs({
      containerName: 'shipshape-sbx-creds-test',
      hostPort: 31234,
      workspaceDir: tempDir,
      env: {
        ALLOWED_CUSTOM_FLAG: 'true',
        GEMINI_API_KEY: 'secret-gemini-key',
        CLERK_SECRET_KEY: 'secret-clerk-key',
        DATABASE_URL: 'postgres://user:pass@host/db',
        AWS_SECRET_ACCESS_KEY: 'aws-secret',
      },
    });

    // Allowed env key should be present
    expect(args).toContain('ALLOWED_CUSTOM_FLAG=true');

    // Builder secrets MUST NOT leak into container args
    expect(args.some((a) => a.includes('GEMINI_API_KEY'))).toBe(false);
    expect(args.some((a) => a.includes('secret-gemini-key'))).toBe(false);
    expect(args.some((a) => a.includes('CLERK_SECRET_KEY'))).toBe(false);
    expect(args.some((a) => a.includes('secret-clerk-key'))).toBe(false);
    expect(args.some((a) => a.includes('DATABASE_URL'))).toBe(false);
    expect(args.some((a) => a.includes('AWS_SECRET_ACCESS_KEY'))).toBe(false);
  });

  it('allocates a valid dynamic loopback TCP port', async () => {
    const port = await DockerSandboxProvider.allocateLocalPort();
    expect(port).toBeGreaterThan(1024);
    expect(port).toBeLessThan(65536);
  });

  it('enforces safe path traversal protection during file writes', async () => {
    const provider = new DockerSandboxProvider({ sandboxRoot: tempDir });
    const fakeHandle = {
      id: 'test-sbx-write',
      projectId: 'test_proj',
      provider: 'docker' as const,
      workspaceDir: tempDir,
      previewUrl: 'http://127.0.0.1:3000',
      status: 'running' as const,
      createdAt: new Date().toISOString(),
    };

    // Valid file write
    await provider.writeFiles(fakeHandle, {
      'src/app/page.tsx': 'export default function Page() { return <div>OK</div>; }',
      'package.json': '{"name": "test-docker-app"}',
    });

    const writtenPage = await fs.readFile(path.join(tempDir, 'src/app/page.tsx'), 'utf-8');
    expect(writtenPage).toContain('OK');

    // Malicious traversal write
    await expect(
      provider.writeFiles(fakeHandle, {
        '../../etc/passwd': 'malicious payload',
      })
    ).rejects.toThrow();

    // Absolute path write
    await expect(
      provider.writeFiles(fakeHandle, {
        '/var/run/docker.sock': 'malicious payload',
      })
    ).rejects.toThrow();
  });

  it('preserves source snapshots and allows restoration independently of container identity', async () => {
    const provider = new DockerSandboxProvider({ sandboxRoot: tempDir });
    const fakeHandle = {
      id: 'test-sbx-snapshot',
      projectId: 'test_proj',
      provider: 'docker' as const,
      workspaceDir: tempDir,
      previewUrl: 'http://127.0.0.1:3000',
      status: 'running' as const,
      createdAt: new Date().toISOString(),
    };

    // Write initial source files
    await provider.writeFiles(fakeHandle, {
      'src/components/Card.tsx': 'export const Card = () => <div>Card V1</div>;',
      'package.json': '{"version": "1.0.0"}',
    });

    // Capture snapshot
    const snapshotId = await provider.snapshot(fakeHandle);
    expect(snapshotId).toMatch(/^snap_docker_/);

    // Modify source files in workspace
    await provider.writeFiles(fakeHandle, {
      'src/components/Card.tsx': 'export const Card = () => <div>Card V2 MODIFIED</div>;',
    });
    const modifiedContent = await fs.readFile(path.join(tempDir, 'src/components/Card.tsx'), 'utf-8');
    expect(modifiedContent).toContain('Card V2 MODIFIED');

    // Restore from snapshot
    await provider.restore(fakeHandle, snapshotId);
    const restoredContent = await fs.readFile(path.join(tempDir, 'src/components/Card.tsx'), 'utf-8');
    expect(restoredContent).toContain('Card V1');
  });

  it('rejects empty commands without executing', async () => {
    const provider = new DockerSandboxProvider({ sandboxRoot: tempDir });
    const fakeHandle = {
      id: 'test-sbx-cmd',
      projectId: 'test_proj',
      provider: 'docker' as const,
      workspaceDir: tempDir,
      previewUrl: 'http://127.0.0.1:3000',
      status: 'running' as const,
      createdAt: new Date().toISOString(),
    };

    const res = await provider.runCommand(fakeHandle, '   ');
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('Empty command');
  });

  it('throws an explicit error when Docker is requested but unavailable on host', async () => {
    const provider = new DockerSandboxProvider({ sandboxRoot: tempDir });

    // When docker is not running on host (as verified in our environment)
    const isAvailable = await DockerSandboxProvider.isDockerAvailable();
    if (!isAvailable) {
      await expect(provider.create('test-project-id')).rejects.toThrow(
        'Docker execution engine requested, but Docker is not available on host. Docker CLI or daemon could not be reached.'
      );
    }
  });

  it('correctly selects provider via getSandboxProvider factory', async () => {
    const localProvider = await getSandboxProvider('local-temp');
    expect(localProvider).toBeInstanceOf(LocalTempSandboxProvider);
    expect(localProvider.name).toBe('local_temp');

    const dockerProvider = await getSandboxProvider('docker');
    expect(dockerProvider).toBeInstanceOf(DockerSandboxProvider);
    expect(dockerProvider.name).toBe('docker');
  });
});

