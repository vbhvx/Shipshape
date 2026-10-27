import path from 'path';

/**
 * Validates that a file path is safe and strictly bounded within the project workspace.
 * Blocks path traversal attacks, absolute paths, null bytes, and sensitive system filenames.
 */
export function validateSafePath(filePath: string): { isValid: boolean; normalizedPath: string; error?: string } {
  if (!filePath || typeof filePath !== 'string') {
    return { isValid: false, normalizedPath: '', error: 'File path must be a non-empty string' };
  }

  // Reject null bytes
  if (filePath.includes('\0')) {
    return { isValid: false, normalizedPath: '', error: 'Null bytes are forbidden' };
  }

  // Reject Windows drive letters
  if (/^[a-zA-Z]:/.test(filePath)) {
    return { isValid: false, normalizedPath: '', error: 'Absolute drive paths are forbidden' };
  }

  // Reject absolute paths starting with /
  if (filePath.startsWith('/') || filePath.startsWith('\\')) {
    return { isValid: false, normalizedPath: '', error: 'Absolute paths are forbidden. Paths must be relative to project root' };
  }

  // Reject explicit path traversal components
  if (filePath.includes('..')) {
    return { isValid: false, normalizedPath: '', error: 'Path traversal detected outside project root' };
  }

  // Normalize path using POSIX style
  const normalized = path.posix.normalize(filePath.replace(/\\/g, '/')).replace(/^\/+/, '');

  if (normalized.startsWith('../') || normalized === '..' || normalized.includes('/../')) {
    return { isValid: false, normalizedPath: '', error: 'Path traversal detected outside project root' };
  }

  // Reject forbidden system paths
  const lower = normalized.toLowerCase();
  const forbiddenPrefixes = [
    '.git/',
    'node_modules/',
    '.env',
    '.next/',
    '.sandboxes/',
    '.shipshape-data/',
    'etc/',
    'var/',
    'tmp/',
  ];

  for (const prefix of forbiddenPrefixes) {
    if (lower === prefix.replace(/\/$/, '') || lower.startsWith(prefix)) {
      return { isValid: false, normalizedPath: '', error: `Access to system directory '${prefix}' is restricted` };
    }
  }

  return { isValid: true, normalizedPath: normalized };
}

/**
 * Removes sensitive tokens, passwords, and private environment credentials from logs and exported code.
 */
export function scrubSecrets(input: string): string {
  if (!input) return '';
  return input
    .replace(/(?:AIzaSy[0-9A-Za-z_-]{33})/g, '[REDACTED_API_KEY]')
    .replace(/(?:sk-[a-zA-Z0-9]{20,})/g, '[REDACTED_OPENAI_KEY]')
    .replace(/(?:ghp_[a-zA-Z0-9]{36})/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(?:postgres:\/\/[^:]+:)([^@]+)(@[^\s/]+)/gi, 'postgres://user:[REDACTED]$2')
    .replace(/(?:DATABASE_URL=["']?)[^"'\n]+/gi, 'DATABASE_URL="[REDACTED]"')
    .replace(/(?:(?!\[REDACTED)SECRET=["']?)[^"'\n]+/gi, 'SECRET="[REDACTED]"');
}
