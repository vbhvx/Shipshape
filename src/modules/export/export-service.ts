import JSZip from 'jszip';
import { db } from '@/lib/db';
import { scrubSecrets } from '@/server/security/safe-paths';

export interface ExportResult {
  zipBuffer: Buffer;
  fileName: string;
  filesIncluded: number;
  totalBytes: number;
}

export async function exportProjectArchive(projectId: string, versionId?: string): Promise<ExportResult> {
  const project = await db.getProject(projectId);
  if (!project) throw new Error('Project not found');

  const targetVersionId = versionId || project.activeVersionId;
  if (!targetVersionId) {
    throw new Error('Project does not have an active or specified version to export');
  }

  const version = await db.getVersion(targetVersionId);
  if (!version) throw new Error(`Version '${targetVersionId}' not found`);

  const files = await db.getFilesForVersion(projectId, targetVersionId);
  const spec = await db.getSpecification(projectId);

  const zip = new JSZip();

  // Root folder in the zip: <project-name>-v<versionNumber>
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
  const rootFolderName = `${safeName}-v${version.versionNumber}`;
  const rootFolder = zip.folder(rootFolderName) || zip;

  let totalBytes = 0;
  let fileCount = 0;

  for (const f of files) {
    // Scrub secrets from all source code before packing
    const safeContent = scrubSecrets(f.content);
    rootFolder.file(f.path, safeContent);
    totalBytes += Buffer.byteLength(safeContent, 'utf-8');
    fileCount++;
  }

  // Ensure safe .env.example is included if not present
  const hasEnv = files.some((f) => f.path === '.env.example');
  if (!hasEnv) {
    const envExampleContent = `# Shipshape Environment Configuration
# Copy this file to .env.local and populate the required keys

NEXT_PUBLIC_APP_NAME="${project.name}"
NEXT_PUBLIC_APP_DESCRIPTION="${project.description.slice(0, 80)}"

# Optional API Keys (Never commit your real keys to version control)
# NEXT_PUBLIC_API_URL="http://localhost:3000"
`;
    rootFolder.file('.env.example', envExampleContent);
    fileCount++;
  }

  // Add clean developer README for the exported standalone application
  const readmeContent = `# ${project.name}

> Exported from Shipshape AI Full-Stack Application Builder
> Version: ${version.versionNumber} (${version.changeSummary})
> Generated on: ${new Date().toISOString()}

## Overview
${project.description}

${spec ? `### Core Features\n${spec.features.map((feat) => `- **${feat.name}**: ${feat.description}`).join('\n')}\n` : ''}

## Getting Started

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Configure Environment Variables
Copy \`.env.example\` to \`.env.local\`:
\`\`\`bash
cp .env.example .env.local
\`\`\`

### 3. Run Development Server
\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### 4. Build for Production
\`\`\`bash
npm run build
npm run start
\`\`\`

## Architecture & Framework
- Framework: Next.js (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Runtime: Node.js (v18+)
`;

  rootFolder.file('README.md', readmeContent);
  fileCount++;

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  await db.recordAudit('code_exported', projectId, undefined, {
    versionId: targetVersionId,
    versionNumber: version.versionNumber,
    fileCount,
    totalBytes: zipBuffer.length,
  });

  return {
    zipBuffer,
    fileName: `${safeName}-v${version.versionNumber}.zip`,
    filesIncluded: fileCount,
    totalBytes: zipBuffer.length,
  };
}
