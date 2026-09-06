import * as Diff from 'diff';
import { GeneratedFile, FileDiff, VersionDiff, ProjectVersion } from '@/types';
import { db } from '@/lib/db';

/**
 * Computes a detailed file-by-file diff between two sets of files.
 */
export function computeVersionDiff(
  oldFiles: GeneratedFile[],
  newFiles: GeneratedFile[],
  toVersionId: string,
  fromVersionId?: string
): VersionDiff {
  const oldFileMap = new Map<string, GeneratedFile>(oldFiles.map((f) => [f.path, f]));
  const newFileMap = new Map<string, GeneratedFile>(newFiles.map((f) => [f.path, f]));

  const allPaths = Array.from(new Set([...oldFileMap.keys(), ...newFileMap.keys()])).sort();
  const fileDiffs: FileDiff[] = [];

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const path of allPaths) {
    const oldF = oldFileMap.get(path);
    const newF = newFileMap.get(path);

    if (!oldF && newF) {
      // Newly added file
      const lines = newF.content.split('\n');
      const additions = lines.length;
      totalAdditions += additions;
      fileDiffs.push({
        path,
        status: 'added',
        newContent: newF.content,
        additions,
        deletions: 0,
        hunks: [
          {
            oldStart: 0,
            oldLines: 0,
            newStart: 1,
            newLines: additions,
            lines: lines.map((l) => `+${l}`),
          },
        ],
      });
    } else if (oldF && !newF) {
      // Deleted file
      const lines = oldF.content.split('\n');
      const deletions = lines.length;
      totalDeletions += deletions;
      fileDiffs.push({
        path,
        status: 'deleted',
        oldContent: oldF.content,
        additions: 0,
        deletions,
        hunks: [
          {
            oldStart: 1,
            oldLines: deletions,
            newStart: 0,
            newLines: 0,
            lines: lines.map((l) => `-${l}`),
          },
        ],
      });
    } else if (oldF && newF) {
      if (oldF.content === newF.content) {
        fileDiffs.push({
          path,
          status: 'unchanged',
          oldContent: oldF.content,
          newContent: newF.content,
          additions: 0,
          deletions: 0,
        });
      } else {
        // Modified file
        const patch = Diff.structuredPatch(path, path, oldF.content, newF.content);
        let additions = 0;
        let deletions = 0;

        const hunks = patch.hunks.map((hunk) => {
          for (const line of hunk.lines) {
            if (line.startsWith('+')) additions++;
            else if (line.startsWith('-')) deletions++;
          }
          return {
            oldStart: hunk.oldStart,
            oldLines: hunk.oldLines,
            newStart: hunk.newStart,
            newLines: hunk.newLines,
            lines: hunk.lines,
          };
        });

        totalAdditions += additions;
        totalDeletions += deletions;

        fileDiffs.push({
          path,
          status: 'modified',
          oldContent: oldF.content,
          newContent: newF.content,
          additions,
          deletions,
          hunks,
        });
      }
    }
  }

  return {
    fromVersionId,
    toVersionId,
    files: fileDiffs,
    summary: {
      filesChanged: fileDiffs.filter((f) => f.status !== 'unchanged').length,
      additions: totalAdditions,
      deletions: totalDeletions,
    },
  };
}

/**
 * Restores a prior version by creating a new version with the prior version's file tree.
 */
export async function restoreVersion(
  projectId: string,
  targetVersionId: string,
  reason?: string
): Promise<ProjectVersion> {
  const versions = await db.listVersions(projectId);
  const target = versions.find((v) => v.id === targetVersionId);
  if (!target) {
    throw new Error(`Target version '${targetVersionId}' not found`);
  }

  const targetFiles = await db.getFilesForVersion(projectId, targetVersionId);
  const nextVersionNumber = versions.length > 0 ? Math.max(...versions.map((v) => v.versionNumber)) + 1 : 1;
  const newVersionId = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newVersion: ProjectVersion = {
    id: newVersionId,
    projectId,
    parentVersionId: targetVersionId,
    versionNumber: nextVersionNumber,
    sourceManifest: targetFiles.map((f) => f.path),
    changeSummary: reason || `Restored from Version ${target.versionNumber}`,
    validationStatus: 'passed',
    createdAt: new Date().toISOString(),
  };

  await db.saveVersion(newVersion);
  await db.saveFiles(projectId, newVersionId, targetFiles);
  await db.updateProject(projectId, { activeVersionId: newVersionId, status: 'ready' });
  await db.recordAudit('version_restored', projectId, undefined, {
    targetVersionId,
    newVersionId,
    versionNumber: nextVersionNumber,
  });

  return newVersion;
}
