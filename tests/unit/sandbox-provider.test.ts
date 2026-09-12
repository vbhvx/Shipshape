import { describe, it, expect } from 'vitest';
import { LocalTempSandboxProvider } from '@/modules/sandbox/sandbox-provider';

describe('SandboxProvider Interface & LocalTemp Implementation', () => {
  const provider = new LocalTempSandboxProvider();
  const testProjectId = `proj_sbx_test_${Date.now()}`;

  it('conforms to SandboxProvider interface and creates a contained sandbox handle', async () => {
    const handle = await provider.create(testProjectId);
    expect(handle.id).toBeDefined();
    expect(handle.projectId).toBe(testProjectId);
    expect(handle.provider).toBe('local_temp');
    expect(handle.status).toBe('running');
    expect(handle.workspaceDir).toBeDefined();

    // Write safe files
    await provider.writeFiles(handle, {
      'src/app/page.tsx': 'export default function Page() { return <h1>Test</h1>; }',
      'package.json': '{"name": "test-app"}',
    });

    const previewUrl = await provider.getPreviewUrl(handle);
    expect(previewUrl).toContain(testProjectId);

    const cmdResult = await provider.runCommand(handle, 'npm test', 5000);
    expect(cmdResult.exitCode).toBe(0);

    await provider.stop(handle);
    expect(handle.status).toBe('stopped');
  });

  it('rejects path traversal attempts when writing files', async () => {
    const handle = await provider.create(testProjectId);

    await expect(
      provider.writeFiles(handle, {
        '../../etc/passwd': 'malicious content',
      })
    ).rejects.toThrow();

    await provider.stop(handle);
  });
});

