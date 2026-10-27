import { describe, it, expect } from 'vitest';
import { computeVersionDiff } from '../../src/modules/versioning/diff-engine';
import { GeneratedFile } from '../../src/types';

describe('Version Diffing Engine', () => {
  const file1: GeneratedFile = {
    path: 'src/app/page.tsx',
    content: 'export default function Home() {\n  return <div>Hello World</div>;\n}',
    responsibility: 'Home page',
    fileType: 'page',
    sizeBytes: 60,
    mimeType: 'text/typescript',
  };

  const file2: GeneratedFile = {
    path: 'src/app/page.tsx',
    content: 'export default function Home() {\n  return <div>Hello Shipshape (Updated)</div>;\n}',
    responsibility: 'Home page',
    fileType: 'page',
    sizeBytes: 75,
    mimeType: 'text/typescript',
  };

  const fileAdded: GeneratedFile = {
    path: 'src/components/Filter.tsx',
    content: 'export function Filter() { return null; }',
    responsibility: 'Filter component',
    fileType: 'component',
    sizeBytes: 40,
    mimeType: 'text/typescript',
  };

  it('accurately identifies modified lines, additions, and deletions', () => {
    const diff = computeVersionDiff([file1], [file2], 'ver_2', 'ver_1');

    expect(diff.toVersionId).toBe('ver_2');
    expect(diff.fromVersionId).toBe('ver_1');
    expect(diff.summary.filesChanged).toBe(1);

    const changed = diff.files.find((f) => f.path === 'src/app/page.tsx');
    expect(changed).toBeDefined();
    expect(changed?.status).toBe('modified');
    expect(changed?.additions).toBeGreaterThan(0);
    expect(changed?.deletions).toBeGreaterThan(0);
  });

  it('accurately identifies added files', () => {
    const diff = computeVersionDiff([file1], [file1, fileAdded], 'ver_2', 'ver_1');
    expect(diff.summary.filesChanged).toBe(1);

    const added = diff.files.find((f) => f.path === 'src/components/Filter.tsx');
    expect(added).toBeDefined();
    expect(added?.status).toBe('added');
  });

  it('accurately identifies deleted files', () => {
    const diff = computeVersionDiff([file1, fileAdded], [file1], 'ver_2', 'ver_1');
    expect(diff.summary.filesChanged).toBe(1);

    const deleted = diff.files.find((f) => f.path === 'src/components/Filter.tsx');
    expect(deleted).toBeDefined();
    expect(deleted?.status).toBe('deleted');
  });
});
