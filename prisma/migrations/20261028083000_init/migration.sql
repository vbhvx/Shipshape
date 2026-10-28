-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clerkId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "activeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_specifications" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "specificationJson" TEXT NOT NULL,
    "planJson" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentVersionId" TEXT,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "sourceManifest" TEXT NOT NULL,
    "snapshotReference" TEXT,
    "changeSummary" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_files" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionId" TEXT,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT NOT NULL DEFAULT 'text/plain',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsibility" TEXT NOT NULL DEFAULT '',
    "fileType" TEXT NOT NULL DEFAULT 'lib',
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "isModified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "baseVersionId" TEXT,
    "resultVersionId" TEXT,
    "runType" TEXT NOT NULL DEFAULT 'generation',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "modelProvider" TEXT NOT NULL DEFAULT 'deterministic',
    "modelIdentifier" TEXT NOT NULL DEFAULT 'gemini-1.5-pro',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "prompt" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "usageMetadata" TEXT,

    CONSTRAINT "generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_events" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sandbox_sessions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL DEFAULT 'isolated_node',
    "externalSandboxId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "port" INTEGER,
    "hostUrl" TEXT,
    "workspaceDir" TEXT,
    "pid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "errorCode" TEXT,

    CONSTRAINT "sandbox_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preview_sessions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sandboxSessionId" TEXT NOT NULL,
    "previewUrl" TEXT NOT NULL,
    "isolationOrigin" TEXT NOT NULL DEFAULT 'sandbox',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "preview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_results" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "projectVersionId" TEXT,
    "checkType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "exitCode" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "logReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorsJson" TEXT,

    CONSTRAINT "build_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_logs" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "streamType" TEXT NOT NULL DEFAULT 'stdout',
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_configurations" (
    "id" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "configJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generationRunId" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "executionSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "storageBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "responsePayload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE INDEX "projects_ownerUserId_idx" ON "projects"("ownerUserId");

-- CreateIndex
CREATE INDEX "project_specifications_projectId_idx" ON "project_specifications"("projectId");

-- CreateIndex
CREATE INDEX "project_versions_projectId_idx" ON "project_versions"("projectId");

-- CreateIndex
CREATE INDEX "project_files_projectId_path_idx" ON "project_files"("projectId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "project_files_projectId_versionId_path_key" ON "project_files"("projectId", "versionId", "path");

-- CreateIndex
CREATE INDEX "generation_runs_projectId_idx" ON "generation_runs"("projectId");

-- CreateIndex
CREATE INDEX "generation_events_generationRunId_sequenceNumber_idx" ON "generation_events"("generationRunId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "sandbox_sessions_projectId_idx" ON "sandbox_sessions"("projectId");

-- CreateIndex
CREATE INDEX "preview_sessions_projectId_idx" ON "preview_sessions"("projectId");

-- CreateIndex
CREATE INDEX "build_results_generationRunId_idx" ON "build_results"("generationRunId");

-- CreateIndex
CREATE INDEX "build_logs_generationRunId_idx" ON "build_logs"("generationRunId");

-- CreateIndex
CREATE INDEX "project_assets_projectId_idx" ON "project_assets"("projectId");

-- CreateIndex
CREATE INDEX "usage_records_projectId_idx" ON "usage_records"("projectId");

-- CreateIndex
CREATE INDEX "audit_events_projectId_idx" ON "audit_events"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_idempotencyKey_key" ON "idempotency_records"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_specifications" ADD CONSTRAINT "project_specifications_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "project_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_events" ADD CONSTRAINT "generation_events_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_sessions" ADD CONSTRAINT "preview_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_sessions" ADD CONSTRAINT "preview_sessions_sandboxSessionId_fkey" FOREIGN KEY ("sandboxSessionId") REFERENCES "sandbox_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_results" ADD CONSTRAINT "build_results_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_results" ADD CONSTRAINT "build_results_projectVersionId_fkey" FOREIGN KEY ("projectVersionId") REFERENCES "project_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_logs" ADD CONSTRAINT "build_logs_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "generation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
