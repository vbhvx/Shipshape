import { prisma } from './prisma';
import {
  User,
  Project,
  ProjectSpecification,
  ProjectVersion,
  GeneratedFile,
  GenerationRun,
  GenerationEvent,
  SandboxSession,
  BuildCheckResult,
  BuildLog,
  ProjectStatus,
} from '@/types';

export const prismaAdapter = {
  // Users
  async getUser(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  },

  async getDefaultUser(): Promise<User> {
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: 'usr_default_builder' },
          { email: 'builder@shipshape.ai' },
        ],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: 'usr_default_builder',
          email: 'builder@shipshape.ai',
          name: 'Alex Rivera',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        },
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  },

  async getUserByClerkId(clerkId: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      clerkId: user.clerkId ?? undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  },

  async createUser(input: {
    clerkId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<User> {
    const user = await prisma.user.create({
      data: {
        clerkId: input.clerkId,
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl ?? null,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      clerkId: user.clerkId ?? undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  },

  // Projects
  async listProjects(userId: string): Promise<Project[]> {
    const projects = await prisma.project.findMany({
      where: {
        ownerUserId: userId,
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((p) => ({
      id: p.id,
      ownerUserId: p.ownerUserId,
      name: p.name,
      description: p.description,
      status: p.status as ProjectStatus,
      activeVersionId: p.activeVersionId ?? undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      archivedAt: p.archivedAt?.toISOString(),
    }));
  },

  async getProject(id: string): Promise<Project | null> {
    const p = await prisma.project.findUnique({ where: { id } });
    if (!p) return null;
    return {
      id: p.id,
      ownerUserId: p.ownerUserId,
      name: p.name,
      description: p.description,
      status: p.status as ProjectStatus,
      activeVersionId: p.activeVersionId ?? undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      archivedAt: p.archivedAt?.toISOString(),
    };
  },

  async createProject(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    await this.getDefaultUser();

    const p = await prisma.project.create({
      data: {
        id: project.id,
        ownerUserId: project.ownerUserId,
        name: project.name,
        description: project.description,
        status: project.status || 'draft',
        activeVersionId: project.activeVersionId ?? null,
      },
    });

    return {
      id: p.id,
      ownerUserId: p.ownerUserId,
      name: p.name,
      description: p.description,
      status: p.status as ProjectStatus,
      activeVersionId: p.activeVersionId ?? undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      archivedAt: p.archivedAt?.toISOString(),
    };
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    try {
      const p = await prisma.project.update({
        where: { id },
        data: {
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.description !== undefined ? { description: updates.description } : {}),
          ...(updates.status !== undefined ? { status: updates.status } : {}),
          ...(updates.activeVersionId !== undefined ? { activeVersionId: updates.activeVersionId } : {}),
          ...(updates.archivedAt !== undefined
            ? { archivedAt: updates.archivedAt ? new Date(updates.archivedAt) : null }
            : {}),
        },
      });

      return {
        id: p.id,
        ownerUserId: p.ownerUserId,
        name: p.name,
        description: p.description,
        status: p.status as ProjectStatus,
        activeVersionId: p.activeVersionId ?? undefined,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        archivedAt: p.archivedAt?.toISOString(),
      };
    } catch {
      return null;
    }
  },

  async deleteProject(id: string, hard = false): Promise<boolean> {
    try {
      if (hard) {
        await prisma.project.delete({ where: { id } });
      } else {
        await prisma.project.update({
          where: { id },
          data: { archivedAt: new Date() },
        });
      }
      return true;
    } catch {
      return false;
    }
  },

  // Specifications
  async getSpecification(projectId: string): Promise<ProjectSpecification | null> {
    const spec = await prisma.projectSpecification.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });
    if (!spec) return null;
    try {
      return JSON.parse(spec.specificationJson) as ProjectSpecification;
    } catch {
      return null;
    }
  },

  async saveSpecification(spec: ProjectSpecification): Promise<ProjectSpecification> {
    const specJson = JSON.stringify(spec);
    const existing = await prisma.projectSpecification.findFirst({
      where: { projectId: spec.projectId },
      orderBy: { versionNumber: 'desc' },
    });

    if (existing) {
      await prisma.projectSpecification.update({
        where: { id: existing.id },
        data: {
          specificationJson: specJson,
          versionNumber: spec.versionNumber || existing.versionNumber,
        },
      });
    } else {
      await prisma.projectSpecification.create({
        data: {
          id: spec.id || `spec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          projectId: spec.projectId,
          versionNumber: spec.versionNumber || 1,
          specificationJson: specJson,
          schemaVersion: spec.schemaVersion || '1.0.0',
        },
      });
    }
    return spec;
  },

  // Versions
  async listVersions(projectId: string): Promise<ProjectVersion[]> {
    const versions = await prisma.projectVersion.findMany({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });

    return versions.map((v) => ({
      id: v.id,
      projectId: v.projectId,
      parentVersionId: v.parentVersionId ?? undefined,
      versionNumber: v.versionNumber,
      sourceManifest: v.sourceManifest ? JSON.parse(v.sourceManifest) : [],
      snapshotReference: v.snapshotReference ?? undefined,
      changeSummary: v.changeSummary ?? '',
      validationStatus: (v.validationStatus as any) || 'pending',
      createdAt: v.createdAt.toISOString(),
    }));
  },

  async getVersion(versionId: string): Promise<ProjectVersion | null> {
    const v = await prisma.projectVersion.findUnique({ where: { id: versionId } });
    if (!v) return null;
    return {
      id: v.id,
      projectId: v.projectId,
      parentVersionId: v.parentVersionId ?? undefined,
      versionNumber: v.versionNumber,
      sourceManifest: v.sourceManifest ? JSON.parse(v.sourceManifest) : [],
      snapshotReference: v.snapshotReference ?? undefined,
      changeSummary: v.changeSummary ?? '',
      validationStatus: (v.validationStatus as any) || 'pending',
      createdAt: v.createdAt.toISOString(),
    };
  },

  async saveVersion(version: ProjectVersion): Promise<ProjectVersion> {
    const sourceManifest = JSON.stringify(version.sourceManifest || []);
    await prisma.projectVersion.upsert({
      where: { id: version.id },
      update: {
        parentVersionId: version.parentVersionId ?? null,
        versionNumber: version.versionNumber,
        sourceManifest,
        snapshotReference: version.snapshotReference ?? null,
        changeSummary: version.changeSummary,
        validationStatus: version.validationStatus,
      },
      create: {
        id: version.id,
        projectId: version.projectId,
        parentVersionId: version.parentVersionId ?? null,
        versionNumber: version.versionNumber,
        sourceManifest,
        snapshotReference: version.snapshotReference ?? null,
        changeSummary: version.changeSummary,
        validationStatus: version.validationStatus,
        createdAt: version.createdAt ? new Date(version.createdAt) : new Date(),
      },
    });
    return version;
  },

  // Project Files
  async getFilesForVersion(projectId: string, versionId: string): Promise<GeneratedFile[]> {
    const files = await prisma.projectFile.findMany({
      where: { projectId, versionId },
      orderBy: { path: 'asc' },
    });

    return files.map((f) => ({
      path: f.path,
      content: f.content,
      responsibility: f.responsibility || '',
      fileType: (f.fileType as any) || 'lib',
      sizeBytes: f.sizeBytes,
      mimeType: f.mimeType || 'text/plain',
      isNew: f.isNew,
      isModified: f.isModified,
    }));
  },

  async getFile(projectId: string, versionId: string, filePath: string): Promise<GeneratedFile | null> {
    const f = await prisma.projectFile.findFirst({
      where: { projectId, versionId, path: filePath },
    });
    if (!f) return null;
    return {
      path: f.path,
      content: f.content,
      responsibility: f.responsibility || '',
      fileType: (f.fileType as any) || 'lib',
      sizeBytes: f.sizeBytes,
      mimeType: f.mimeType || 'text/plain',
      isNew: f.isNew,
      isModified: f.isModified,
    };
  },

  async saveFiles(projectId: string, versionId: string, files: GeneratedFile[]): Promise<void> {
    for (const f of files) {
      const fileId = `${projectId}_${versionId}_${f.path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      await prisma.projectFile.upsert({
        where: {
          projectId_versionId_path: {
            projectId,
            versionId,
            path: f.path,
          },
        },
        update: {
          content: f.content,
          sizeBytes: f.sizeBytes || Buffer.byteLength(f.content, 'utf-8'),
          mimeType: f.mimeType || 'text/plain',
          responsibility: f.responsibility || '',
          fileType: f.fileType || 'lib',
          isNew: f.isNew ?? false,
          isModified: f.isModified ?? false,
          updatedAt: new Date(),
        },
        create: {
          id: fileId,
          projectId,
          versionId,
          path: f.path,
          content: f.content,
          sizeBytes: f.sizeBytes || Buffer.byteLength(f.content, 'utf-8'),
          mimeType: f.mimeType || 'text/plain',
          responsibility: f.responsibility || '',
          fileType: f.fileType || 'lib',
          isNew: f.isNew ?? false,
          isModified: f.isModified ?? false,
          updatedAt: new Date(),
        },
      });
    }
  },

  // Generation Runs
  async getGenerationRun(runId: string): Promise<GenerationRun | null> {
    const r = await prisma.generationRun.findUnique({ where: { id: runId } });
    if (!r) return null;
    return {
      id: r.id,
      projectId: r.projectId,
      baseVersionId: r.baseVersionId ?? undefined,
      resultVersionId: r.resultVersionId ?? undefined,
      runType: (r.runType as any) || 'generation',
      status: (r.status as any) || 'queued',
      modelProvider: (r.modelProvider as any) || 'deterministic',
      modelIdentifier: r.modelIdentifier,
      attemptCount: r.attemptCount,
      prompt: r.prompt ?? undefined,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString(),
      errorCode: r.errorCode ?? undefined,
      errorMessage: r.errorMessage ?? undefined,
      usageMetadata: r.usageMetadata ? JSON.parse(r.usageMetadata) : undefined,
    };
  },

  async saveGenerationRun(run: GenerationRun): Promise<GenerationRun> {
    await prisma.generationRun.upsert({
      where: { id: run.id },
      update: {
        status: run.status,
        resultVersionId: run.resultVersionId ?? null,
        finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
        errorCode: run.errorCode ?? null,
        errorMessage: run.errorMessage ?? null,
        usageMetadata: run.usageMetadata ? JSON.stringify(run.usageMetadata) : null,
      },
      create: {
        id: run.id,
        projectId: run.projectId,
        baseVersionId: run.baseVersionId ?? null,
        resultVersionId: run.resultVersionId ?? null,
        runType: run.runType,
        status: run.status,
        modelProvider: run.modelProvider,
        modelIdentifier: run.modelIdentifier,
        attemptCount: run.attemptCount,
        prompt: run.prompt ?? null,
        startedAt: run.startedAt ? new Date(run.startedAt) : new Date(),
        finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
        errorCode: run.errorCode ?? null,
        errorMessage: run.errorMessage ?? null,
        usageMetadata: run.usageMetadata ? JSON.stringify(run.usageMetadata) : null,
      },
    });
    return run;
  },

  async updateGenerationRun(runId: string, updates: Partial<GenerationRun>): Promise<GenerationRun | null> {
    try {
      const terminalStatuses = ['completed', 'failed', 'cancelled'];
      const dataToUpdate = {
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.resultVersionId !== undefined ? { resultVersionId: updates.resultVersionId } : {}),
        ...(updates.finishedAt !== undefined
          ? { finishedAt: updates.finishedAt ? new Date(updates.finishedAt) : null }
          : {}),
        ...(updates.errorCode !== undefined ? { errorCode: updates.errorCode } : {}),
        ...(updates.errorMessage !== undefined ? { errorMessage: updates.errorMessage } : {}),
        ...(updates.usageMetadata !== undefined
          ? { usageMetadata: updates.usageMetadata ? JSON.stringify(updates.usageMetadata) : null }
          : {}),
      };

      // Atomic conditional update: strictly reject mutating any run that has already reached a terminal state
      const { count } = await prisma.generationRun.updateMany({
        where: {
          id: runId,
          status: { notIn: terminalStatuses },
        },
        data: dataToUpdate,
      });

      if (count === 0) {
        // Record either does not exist or has already reached a terminal state.
        // Return existing database state without mutating anything.
        return this.getGenerationRun(runId);
      }

      return this.getGenerationRun(runId);
    } catch {
      return null;
    }
  },

  async publishVersionIfActive(
    runId: string,
    projectId: string,
    version: ProjectVersion,
    files: GeneratedFile[]
  ): Promise<ProjectVersion | null> {
    try {
      const terminalStatuses = ['completed', 'failed', 'cancelled'];
      const sourceManifest = JSON.stringify(version.sourceManifest || []);

      // Execute all publication mutations inside a single database transaction
      return await prisma.$transaction(async (tx) => {
        // Step 1: Conditionally lock and transition the generation run to 'completed'
        // If cancellation won concurrently or the run is already terminal, this updates 0 rows
        const { count } = await tx.generationRun.updateMany({
          where: {
            id: runId,
            projectId,
            status: { notIn: terminalStatuses },
          },
          data: {
            status: 'completed',
            resultVersionId: version.id,
            finishedAt: new Date(),
          },
        });

        if (count === 0) {
          // Run was cancelled or has already reached a terminal state.
          // Roll back transaction; no version, files, or project mutation will be committed.
          return null;
        }

        // Step 2: Persist the project version record
        const createdVersion = await tx.projectVersion.upsert({
          where: { id: version.id },
          update: {
            parentVersionId: version.parentVersionId ?? null,
            versionNumber: version.versionNumber,
            sourceManifest,
            snapshotReference: version.snapshotReference ?? null,
            changeSummary: version.changeSummary ?? null,
            validationStatus: version.validationStatus,
          },
          create: {
            id: version.id,
            projectId,
            parentVersionId: version.parentVersionId ?? null,
            versionNumber: version.versionNumber,
            sourceManifest,
            snapshotReference: version.snapshotReference ?? null,
            changeSummary: version.changeSummary ?? null,
            validationStatus: version.validationStatus,
            createdAt: version.createdAt ? new Date(version.createdAt) : new Date(),
          },
        });

        // Step 3: Persist all generated project files
        for (const f of files) {
          const fileId = `${projectId}_${version.id}_${f.path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          await tx.projectFile.upsert({
            where: {
              projectId_versionId_path: {
                projectId,
                versionId: version.id,
                path: f.path,
              },
            },
            update: {
              content: f.content,
              sizeBytes: Buffer.byteLength(f.content, 'utf-8'),
              mimeType: f.mimeType || 'text/plain',
              responsibility: f.responsibility || '',
              fileType: f.fileType || 'lib',
              isNew: f.isNew ?? false,
              isModified: f.isModified ?? false,
              updatedAt: new Date(),
            },
            create: {
              id: fileId,
              projectId,
              versionId: version.id,
              path: f.path,
              content: f.content,
              sizeBytes: Buffer.byteLength(f.content, 'utf-8'),
              mimeType: f.mimeType || 'text/plain',
              responsibility: f.responsibility || '',
              fileType: f.fileType || 'lib',
              isNew: f.isNew ?? false,
              isModified: f.isModified ?? false,
              updatedAt: new Date(),
            },
          });
        }

        // Step 4: Atomically update the project's activeVersionId and status to 'running'
        await tx.project.update({
          where: { id: projectId },
          data: {
            activeVersionId: version.id,
            status: 'running',
            updatedAt: new Date(),
          },
        });

        return {
          id: createdVersion.id,
          projectId: createdVersion.projectId,
          parentVersionId: createdVersion.parentVersionId ?? undefined,
          versionNumber: createdVersion.versionNumber,
          sourceManifest: JSON.parse(createdVersion.sourceManifest || '[]'),
          snapshotReference: createdVersion.snapshotReference ?? undefined,
          changeSummary: createdVersion.changeSummary ?? '',
          validationStatus: (createdVersion.validationStatus as any) || 'passed',
          createdAt: createdVersion.createdAt.toISOString(),
        };
      });
    } catch (err) {
      console.error('publishVersionIfActive transaction error:', err);
      return null;
    }
  },

  // Generation Events
  async addGenerationEvent(runId: string, event: Omit<GenerationEvent, 'id' | 'createdAt'>): Promise<GenerationEvent> {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const e = await prisma.generationEvent.create({
      data: {
        id,
        generationRunId: runId,
        sequenceNumber: event.sequenceNumber,
        eventType: event.eventType,
        message: event.message,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    });

    return {
      id: e.id,
      generationRunId: e.generationRunId,
      sequenceNumber: e.sequenceNumber,
      eventType: e.eventType as any,
      message: e.message,
      metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
      createdAt: e.createdAt.toISOString(),
    };
  },

  async getGenerationEvents(runId: string): Promise<GenerationEvent[]> {
    const events = await prisma.generationEvent.findMany({
      where: { generationRunId: runId },
      orderBy: { sequenceNumber: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      generationRunId: e.generationRunId,
      sequenceNumber: e.sequenceNumber,
      eventType: e.eventType as any,
      message: e.message,
      metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
      createdAt: e.createdAt.toISOString(),
    }));
  },

  // Sandbox Sessions
  async getSandboxSession(projectId: string): Promise<SandboxSession | null> {
    const s = await prisma.sandboxSession.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (!s) return null;
    return {
      id: s.id,
      projectId: s.projectId,
      providerKey: (s.providerKey as any) || 'isolated_node',
      externalSandboxId: s.externalSandboxId ?? undefined,
      status: (s.status as any) || 'created',
      port: s.port ?? undefined,
      hostUrl: s.hostUrl ?? undefined,
      workspaceDir: s.workspaceDir ?? undefined,
      pid: s.pid ?? undefined,
      createdAt: s.createdAt.toISOString(),
      lastActivityAt: s.lastActivityAt.toISOString(),
      expiresAt: s.expiresAt?.toISOString(),
      terminatedAt: s.terminatedAt?.toISOString(),
      errorCode: s.errorCode ?? undefined,
    };
  },

  async saveSandboxSession(session: SandboxSession): Promise<SandboxSession> {
    await prisma.sandboxSession.upsert({
      where: { id: session.id },
      update: {
        status: session.status,
        port: session.port ?? null,
        hostUrl: session.hostUrl ?? null,
        workspaceDir: session.workspaceDir ?? null,
        pid: session.pid ?? null,
        lastActivityAt: new Date(),
        terminatedAt: session.terminatedAt ? new Date(session.terminatedAt) : null,
        errorCode: session.errorCode ?? null,
      },
      create: {
        id: session.id,
        projectId: session.projectId,
        providerKey: session.providerKey,
        externalSandboxId: session.externalSandboxId ?? null,
        status: session.status,
        port: session.port ?? null,
        hostUrl: session.hostUrl ?? null,
        workspaceDir: session.workspaceDir ?? null,
        pid: session.pid ?? null,
        createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
        lastActivityAt: new Date(),
        expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
        terminatedAt: session.terminatedAt ? new Date(session.terminatedAt) : null,
        errorCode: session.errorCode ?? null,
      },
    });
    return session;
  },

  // Build Results & Logs
  async saveBuildResults(runId: string, results: BuildCheckResult[]): Promise<void> {
    if (results.length === 0) return;
    await prisma.buildResult.createMany({
      data: results.map((r) => ({
        id: r.id || `bld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        generationRunId: runId,
        projectVersionId: r.projectVersionId ?? null,
        checkType: r.checkType,
        status: r.status,
        exitCode: r.exitCode ?? 0,
        durationMs: r.durationMs ?? 0,
        logReference: r.logReference ?? null,
        errorsJson: r.errors ? JSON.stringify(r.errors) : null,
      })),
    });
  },

  async getBuildResults(runId: string): Promise<BuildCheckResult[]> {
    const results = await prisma.buildResult.findMany({
      where: { generationRunId: runId },
    });

    return results.map((r) => ({
      id: r.id,
      generationRunId: r.generationRunId,
      projectVersionId: r.projectVersionId ?? undefined,
      checkType: r.checkType as any,
      status: r.status as any,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      logReference: r.logReference ?? undefined,
      errors: r.errorsJson ? JSON.parse(r.errorsJson) : undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  },

  async addBuildLog(runId: string, streamType: 'stdout' | 'stderr' | 'system', content: string): Promise<void> {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await prisma.buildLog.create({
      data: {
        id,
        generationRunId: runId,
        streamType,
        content,
        timestamp: new Date(),
      },
    });
  },

  async getBuildLogs(runId: string): Promise<BuildLog[]> {
    const logs = await prisma.buildLog.findMany({
      where: { generationRunId: runId },
      orderBy: { timestamp: 'asc' },
      take: 1000,
    });

    return logs.map((l) => ({
      id: l.id,
      generationRunId: l.generationRunId,
      streamType: l.streamType as any,
      content: l.content,
      timestamp: l.timestamp.toISOString(),
    }));
  },

  // Audit Events
  async recordAudit(action: string, projectId?: string, userId?: string, metadata?: any): Promise<void> {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await prisma.auditEvent.create({
      data: {
        id,
        action,
        projectId: projectId ?? null,
        userId: userId ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  },
};
