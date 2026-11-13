import { z } from 'zod';

export type UserRole = 'developer' | 'founder' | 'builder' | 'learner';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  clerkId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Transitions and meanings: src/lib/runs/status.ts. Archiving is `archivedAt`, not a status. */
export type ProjectStatus =
  | 'draft'
  | 'planning'
  | 'generating'
  | 'ready'
  | 'running'
  | 'error';

export interface Project {
  id: string;
  ownerUserId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  activeVersionId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface RouteSpecification {
  path: string;
  name: string;
  description: string;
  isProtected?: boolean;
}

export interface FeatureSpecification {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'ui' | 'api' | 'data' | 'auth';
  status: 'planned' | 'generating' | 'implemented' | 'unsupported';
}

export interface DataEntitySpecification {
  name: string;
  description: string;
  fields: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
}

export interface IntegrationRequirement {
  name: string;
  type: string;
  description: string;
  isConfigured: boolean;
  requiredEnvVars?: string[];
}

export interface DesignSpecification {
  theme: 'dark' | 'light' | 'system';
  primaryColor: string;
  style: 'modern-minimal' | 'glassmorphism' | 'saas-clean' | 'dashboard-dark';
  typography: string;
}

export interface ProjectSpecification {
  id: string;
  projectId: string;
  name: string;
  description: string;
  targetUsers: string[];
  routes: RouteSpecification[];
  features: FeatureSpecification[];
  dataEntities: DataEntitySpecification[];
  integrations: IntegrationRequirement[];
  designSystem: DesignSpecification;
  technicalConstraints: string[];
  acceptanceCriteria: string[];
  versionNumber: number;
  schemaVersion: string;
  createdAt: string;
}

export interface PlannedComponent {
  name: string;
  file: string;
  responsibility: string;
  stateManagement: 'local' | 'context' | 'server';
}

export interface ApplicationPlan {
  projectId: string;
  specification: ProjectSpecification;
  routes: RouteSpecification[];
  majorComponents: PlannedComponent[];
  dataModel: {
    entities: DataEntitySpecification[];
    storageStrategy: 'localStorage' | 'inMemoryApi' | 'sqlite' | 'postgres';
    notes: string;
  };
  userInteractions: string[];
  requiredServices: string[];
  dependencies: Record<string, string>;
  validationSteps: string[];
  assumptions: string[];
  unresolvedQuestions: string[];
  createdAt: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  responsibility: string;
  fileType: 'page' | 'component' | 'layout' | 'api' | 'lib' | 'config' | 'style' | 'asset';
  sizeBytes: number;
  mimeType: string;
  isNew?: boolean;
  isModified?: boolean;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  parentVersionId?: string;
  versionNumber: number;
  sourceManifest: string[]; // file paths
  snapshotReference?: string;
  changeSummary: string;
  validationStatus: 'pending' | 'passed' | 'failed';
  createdAt: string;
  files?: GeneratedFile[];
}

/** Transitions: src/lib/runs/status.ts (RUN_STEPS). */
export type GenerationRunStatus =
  | 'queued'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'building'
  | 'starting'
  | 'preview_ready'
  | 'repairing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface GenerationEvent {
  id: string;
  generationRunId: string;
  sequenceNumber: number;
  eventType:
    | 'step_started'
    | 'step_completed'
    | 'file_generated'
    | 'log_output'
    | 'error'
    | 'repair_attempt'
    | 'preview_ready';
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface GenerationRun {
  id: string;
  projectId: string;
  baseVersionId?: string;
  resultVersionId?: string;
  runType: 'generation' | 'modification' | 'repair';
  status: GenerationRunStatus;
  modelProvider: 'gemini' | 'openai' | 'deterministic' | 'fixture';
  modelIdentifier: string;
  attemptCount: number;
  prompt?: string;
  startedAt: string;
  finishedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  usageMetadata?: {
    tokens?: number;
    filesCount?: number;
    durationMs?: number;
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
    thoughtTokens?: number;
    isSyntheticTokenCount?: boolean;
  };
}

export interface SandboxSession {
  id: string;
  projectId: string;
  providerKey: 'isolated_node' | 'mock_cloud';
  externalSandboxId?: string;
  /** The preview is available (`running`) or was stopped; no process runs behind it. */
  status: 'running' | 'stopped';
  port?: number;
  hostUrl?: string;
  workspaceDir?: string;
  pid?: number;
  createdAt: string;
  lastActivityAt: string;
  expiresAt?: string;
  terminatedAt?: string;
  errorCode?: string;
}

export interface BuildCheckResult {
  id: string;
  generationRunId: string;
  projectVersionId?: string;
  checkType: 'typecheck' | 'lint' | 'build' | 'runtime_startup';
  status: 'passed' | 'failed' | 'skipped';
  exitCode: number;
  durationMs: number;
  logReference?: string;
  errors?: {
    file?: string;
    line?: number;
    column?: number;
    message: string;
    code?: string;
  }[];
  createdAt: string;
}

export interface BuildLog {
  id: string;
  generationRunId: string;
  streamType: 'stdout' | 'stderr' | 'system';
  content: string;
  timestamp: string;
}

export interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  oldContent?: string;
  newContent?: string;
  hunks?: {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }[];
  additions: number;
  deletions: number;
}

export interface VersionDiff {
  fromVersionId?: string;
  toVersionId: string;
  files: FileDiff[];
  summary: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

// Zod Validation Schemas for API Requests
export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  templateId: z.string().optional().default('nextjs-typescript'),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(2000).optional(),
  activeVersionId: z.string().optional(),
}).strict();

export const PlanRequestSchema = z.object({
  prompt: z.string().min(3).max(5000),
});

export const GenerateRequestSchema = z.object({
  prompt: z.string().min(3).max(5000).optional(),
  // Plans are generated server-side today. Keep this optional for backwards
  // compatibility with callers that already have a plan, but reject scalars.
  plan: z.object({}).passthrough().optional(),
  modelProvider: z.enum(['gemini', 'deterministic', 'fixture']).optional(),
  fixtureId: z.string().optional(),
}).refine((value) => Boolean(value.prompt || value.plan), {
  message: 'Provide a build prompt or a structured plan',
});

export const ModifyRequestSchema = z.object({
  instruction: z.string().min(3).max(5000),
  baseVersionId: z.string().optional(),
});

// Only user-editable specification content. Identity and bookkeeping fields
// (id, projectId, versionNumber, schemaVersion, createdAt) are server-owned;
// `.strict()` rejects attempts to overwrite them.
const SpecItemSchema = z.object({}).passthrough();

export const UpdateSpecificationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  targetUsers: z.array(z.string().max(500)).max(50).optional(),
  routes: z.array(SpecItemSchema).max(100).optional(),
  features: z.array(SpecItemSchema).max(200).optional(),
  dataEntities: z.array(SpecItemSchema).max(100).optional(),
  integrations: z.array(SpecItemSchema).max(50).optional(),
  designSystem: SpecItemSchema.optional(),
  technicalConstraints: z.array(z.string().max(1000)).max(100).optional(),
  acceptanceCriteria: z.array(z.string().max(1000)).max(200).optional(),
}).strict();

export const RestoreVersionSchema = z.object({
  versionId: z.string().min(1),
  reason: z.string().optional(),
});
