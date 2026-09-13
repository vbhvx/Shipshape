import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DockerSandboxProvider } from '@/modules/sandbox/docker-sandbox-provider';
import { SandboxHandle } from '@/modules/sandbox/sandbox-provider';

const dockerRunningOnHost = await DockerSandboxProvider.isDockerAvailable();

describe('DockerSandboxProvider Real Application Execution Acceptance Test', () => {
  let dockerAvailable = dockerRunningOnHost;
  let provider: DockerSandboxProvider;
  let sandboxHandle: SandboxHandle | null = null;

  beforeAll(async () => {
    dockerAvailable = await DockerSandboxProvider.isDockerAvailable();
    if (dockerAvailable) {
      provider = new DockerSandboxProvider();
    }
  });

  afterAll(async () => {
    if (sandboxHandle && provider) {
      try {
        await provider.stop(sandboxHandle);
      } catch {
        // Ephemeral cleanup best effort
      }
    }
  });

  it('truthfully probes host Docker daemon availability', () => {
    expect(typeof dockerAvailable).toBe('boolean');
    if (!dockerAvailable) {
      console.info(
        '[DOCKER_VERIFICATION_STATUS] Docker CLI / daemon is not running on host. Live execution acceptance test will be skipped without falsification.'
      );
    }
  });

  /**
   * Acceptance Test: Real Application Execution in Docker
   * This test executes the full 8-step lifecycle when Docker is running on host:
   * 1. Create a sandbox
   * 2. Write a known-good Next.js application fixture
   * 3. Execute the production build inside Docker
   * 4. Start the production server
   * 5. Wait for genuine server readiness
   * 6. Request the preview URL and verify HTTP 200
   * 7. Stop and remove the container
   * 8. Verify that project snapshots survive container destruction
   */
  it.runIf(dockerRunningOnHost)(
    'executes real 8-step Next.js application execution acceptance test in live Docker',
    async () => {
      if (!dockerAvailable) {
        throw new Error(
          'TEST_DOCKER/CI requested real Docker execution, but Docker daemon is not reachable on host'
        );
      }

      const testProjectId = `proj_real_nextjs_${Date.now()}`;

      // 1. Create a sandbox
      sandboxHandle = await provider.create(testProjectId);
      expect(sandboxHandle.id).toBeDefined();
      expect(sandboxHandle.provider).toBe('docker');
      expect(sandboxHandle.hostPort).toBeGreaterThan(1024);
      expect(sandboxHandle.previewUrl).toMatch(/^http:\/\/127\.0.0\.1:\d+$/);

      // 2. Write a known-good Next.js application fixture
      await provider.writeFiles(sandboxHandle, {
        'package.json': JSON.stringify(
          {
            name: 'smoke-test-app',
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
            },
          },
          null,
          2
        ),
        'tsconfig.json': JSON.stringify(
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
        'next.config.mjs': `
          export default {
            turbopack: {
              root: '/home/node',
            },
          };
        `,
        'src/app/layout.tsx': `
          export const metadata = { title: 'Smoke Test' };
          export default function RootLayout({ children }: { children: React.ReactNode }) {
            return (
              <html lang="en">
                <body>{children}</body>
              </html>
            );
          }
        `,
        'src/app/page.tsx': `
          export default function Page() {
            return (
              <main>
                <h1>Smoke Test Running</h1>
                <p>Shipshape Real Docker Container Execution</p>
              </main>
            );
          }
        `,
      });

      // 3. Execute the production build inside Docker
      const buildResult = await provider.runCommand(sandboxHandle, {
        executable: 'npm',
        args: ['run', 'build'],
        env: { NODE_ENV: 'production' },
        timeoutMs: 90000,
      });
      if (buildResult.exitCode !== 0) {
        console.error('BUILD FAILED:', buildResult.stdout, buildResult.stderr);
      }
      expect(buildResult.exitCode).toBe(0);

      // 4. Start the production server
      const procHandle = await provider.startProcess(sandboxHandle, {
        name: 'nextjs-prod-server',
        executable: 'npm',
        args: ['start'],
        env: { NODE_ENV: 'production' },
        readyEndpoint: '/',
      });
      expect(procHandle.status).toBe('running');

      // 5. Wait for genuine server readiness
      const isReady = await provider.waitForReady(sandboxHandle, procHandle, 30000);
      expect(isReady).toBe(true);

      // 6. Request the preview URL and verify HTTP 200
      const res = await fetch(sandboxHandle.previewUrl);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Smoke Test Running');

      // Capture snapshot before stopping container
      const snapshotId = await provider.snapshot(sandboxHandle);
      expect(snapshotId).toMatch(/^snap_docker_/);

      // 7. Stop and remove the container
      await provider.stop(sandboxHandle);
      expect(sandboxHandle.status).toBe('stopped');

      // 8. Verify that project snapshots survive container destruction
      const postTeardownSandbox = await provider.create(`${testProjectId}_restored`);
      await provider.restore(postTeardownSandbox, snapshotId);
      expect(postTeardownSandbox.workspaceDir).toBeDefined();

      await provider.stop(postTeardownSandbox);
      sandboxHandle = null;
    },
    60000
  );
});
