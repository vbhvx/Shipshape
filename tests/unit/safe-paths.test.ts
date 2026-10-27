import { describe, it, expect } from 'vitest';
import { validateSafePath, scrubSecrets } from '../../src/server/security/safe-paths';

describe('Safe Path Validation & Secret Scrubbing', () => {
  it('allows valid project workspace paths', () => {
    const validPaths = [
      'src/app/page.tsx',
      'src/components/HeaderNav.tsx',
      'package.json',
      'tsconfig.json',
      'README.md',
      'src/lib/storage.ts',
    ];

    for (const p of validPaths) {
      const res = validateSafePath(p);
      expect(res.isValid).toBe(true);
      expect(res.normalizedPath).toBe(p);
    }
  });

  it('rejects path traversal attempts', () => {
    const traversalPaths = [
      '../etc/passwd',
      '../../secret.txt',
      'src/app/../../outside.ts',
      '..',
      '/etc/shadow',
    ];

    for (const p of traversalPaths) {
      const res = validateSafePath(p);
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  it('rejects null bytes and drive letters', () => {
    expect(validateSafePath('src/app\0bad.tsx').isValid).toBe(false);
    expect(validateSafePath('C:\\Windows\\System32').isValid).toBe(false);
  });

  it('rejects forbidden system directories', () => {
    expect(validateSafePath('.git/config').isValid).toBe(false);
    expect(validateSafePath('node_modules/bad-pkg/index.js').isValid).toBe(false);
    expect(validateSafePath('.env.local').isValid).toBe(false);
    expect(validateSafePath('.sandboxes/proj_1/key').isValid).toBe(false);
  });

  it('scrubs API keys, tokens, and database passwords from text', () => {
    const rawLogs = `
      Connected with API_KEY="AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q"
      OpenAI secret is sk-abcdef1234567890abcdef1234567890
      DB: postgres://postgres:SuperSecretPassword123@aws.db.internal:5432/production
    `;

    const scrubbed = scrubSecrets(rawLogs);
    expect(scrubbed).not.toContain('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q');
    expect(scrubbed).not.toContain('SuperSecretPassword123');
    expect(scrubbed).not.toContain('sk-abcdef1234567890abcdef1234567890');
    expect(scrubbed).toContain('[REDACTED_API_KEY]');
    expect(scrubbed).toContain('[REDACTED]');
  });
});
