import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });

const APPLY = process.argv.slice(2).includes("--apply");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--apply");

if (unknownArgs.length) {
  throw new Error(`Unknown arguments: ${unknownArgs.join(", ")}`);
}

const sourcePath = path.resolve(".shipshape-data/store.json");
const archiveDir = path.resolve(".shipshape-data/migration-review");

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Source store not found: ${sourcePath}`);
}

const sourceBytes = fs.readFileSync(sourcePath);
const sourceHash = crypto.createHash("sha256").update(sourceBytes).digest("hex");

const EXPECTED_SOURCE_SHA256 =
  "572859a240d9b26d7e7dda05769cb24ba8e4a69e137524dcf8b4be8a33d98831";

if (sourceHash !== EXPECTED_SOURCE_SHA256) {
  throw new Error(
    "Source JSON hash differs from the verified migration baseline. " +
    "Refusing to continue; review the source before importing."
  );
}
const store = JSON.parse(sourceBytes.toString("utf8"));

const values = (value) =>
  value && typeof value === "object" ? Object.values(value) : [];

const users = values(store.users);
const projects = values(store.projects);
const specifications = values(store.specifications);
const versions = values(store.versions);
const files = values(store.files);
const runs = values(store.generationRuns);
const sessions = values(store.sandboxSessions);

const events = Object.values(store.generationEvents ?? {}).flatMap(
  (value) => Array.isArray(value) ? value : []
);

const logs = Object.values(store.buildLogs ?? {}).flatMap(
  (value) => Array.isArray(value) ? value : []
);

const auditEvents = Object.entries(store.auditEvents ?? {}).flatMap(
  ([storageKey, value]) =>
    (Array.isArray(value) ? value : []).map((event) => ({
      ...event,
      storageKey,
    }))
);

const projectIds = new Set(projects.map((item) => item.id));
const versionIds = new Set(versions.map((item) => item.id));
const validVersions = versions.filter((item) => projectIds.has(item.projectId));
const validVersionIds = new Set(validVersions.map((item) => item.id));

const validFiles = files.filter((item) =>
  projectIds.has(item.projectId) &&
  item.versionId &&
  validVersionIds.has(item.versionId) &&
  versions.some(
    (version) =>
      version.id === item.versionId &&
      version.projectId === item.projectId
  )
);

const validRuns = runs.filter((item) => projectIds.has(item.projectId));
const validRunIds = new Set(validRuns.map((item) => item.id));
const validEvents = events.filter((item) => validRunIds.has(item.generationRunId));
const validLogs = logs.filter((item) => validRunIds.has(item.generationRunId));
const validSessions = sessions.filter((item) => projectIds.has(item.projectId));

const validAuditEvents = auditEvents.filter(
  (item) => !item.projectId || projectIds.has(item.projectId)
);

const getCollection = (key) => values(store[key]);

// Do not silently skip collections that this importer has not mapped.
for (const key of [
  "previewSessions",
  "buildResults",
  "projectAssets",
  "providerConfigurations",
  "usageRecords",
  "idempotency",
]) {
  const count = getCollection(key).length;
  if (count !== 0) {
    throw new Error(
      `Source collection "${key}" contains ${count} records. ` +
      "Review and map this collection before importing."
    );
  }
}

const idForFile = (item) =>
  "file_" + crypto
    .createHash("sha256")
    .update(`${item.projectId}\0${item.versionId}\0${item.path}`)
    .digest("hex")
    .slice(0, 32);

const json = (value) => value == null ? null : JSON.stringify(value);
const _date = (value, fallback = null) => value ?? fallback;

const candidates = {
  users: users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    clerkId: null,
  })),

  projects: projects.map((p) => ({
    id: p.id,
    ownerUserId: p.ownerUserId,
    name: p.name,
    description: p.description,
    status: p.status ?? "draft",
    activeVersionId: p.activeVersionId ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    archivedAt: p.archivedAt ?? null,
  })),

  project_specifications: specifications.map((s) => ({
    id: s.id,
    projectId: s.projectId,
    versionNumber: s.versionNumber ?? 1,
    specificationJson: json(s),
    planJson: null,
    schemaVersion: s.schemaVersion ?? "1.0.0",
    createdAt: s.createdAt,
  })),

  project_versions: validVersions.map((v) => ({
    id: v.id,
    projectId: v.projectId,
    parentVersionId: v.parentVersionId ?? null,
    versionNumber: v.versionNumber ?? 1,
    sourceManifest: json(v.sourceManifest ?? []),
    snapshotReference: v.snapshotReference ?? null,
    changeSummary: v.changeSummary ?? null,
    validationStatus: v.validationStatus ?? "pending",
    createdAt: v.createdAt,
  })),

  project_files: validFiles.map((f) => ({
    id: idForFile(f),
    projectId: f.projectId,
    versionId: f.versionId,
    path: f.path,
    content: f.content,
    sizeBytes: f.sizeBytes ?? 0,
    mimeType: f.mimeType ?? "text/plain",
    updatedAt: f.updatedAt ?? new Date(0).toISOString(),
    responsibility: f.responsibility ?? "",
    fileType: f.fileType ?? "lib",
    isNew: f.isNew ?? false,
    isModified: f.isModified ?? false,
  })),

  generation_runs: validRuns.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    baseVersionId: r.baseVersionId ?? null,
    resultVersionId: r.resultVersionId ?? null,
    runType: r.runType ?? "generation",
    status: r.status ?? "queued",
    modelProvider: r.modelProvider ?? "deterministic",
    modelIdentifier: r.modelIdentifier ?? "gemini-1.5-pro",
    attemptCount: r.attemptCount ?? 1,
    prompt: r.prompt ?? null,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? null,
    errorCode: r.errorCode ?? null,
    errorMessage: r.errorMessage ?? null,
    usageMetadata: json(r.usageMetadata),
  })),

  generation_events: validEvents.map((e) => ({
    id: e.id,
    generationRunId: e.generationRunId,
    sequenceNumber: e.sequenceNumber,
    eventType: e.eventType,
    message: e.message,
    metadata: json(e.metadata),
    createdAt: e.createdAt,
  })),

  sandbox_sessions: validSessions.map((s) => ({
    id: s.id,
    projectId: s.projectId,
    providerKey: s.providerKey ?? "isolated_node",
    externalSandboxId: s.externalSandboxId ?? null,
    status: s.status,
    port: s.port ?? null,
    hostUrl: s.hostUrl ?? null,
    workspaceDir: s.workspaceDir ?? null,
    pid: s.pid ?? null,
    createdAt: s.createdAt,
    lastActivityAt: s.lastActivityAt ?? s.createdAt,
    expiresAt: s.expiresAt ?? null,
    terminatedAt: s.terminatedAt ?? null,
    errorCode: s.errorCode ?? null,
  })),

  build_logs: validLogs.map((l) => ({
    id: l.id,
    generationRunId: l.generationRunId,
    streamType: l.streamType ?? "stdout",
    content: l.content,
    timestamp: l.timestamp,
  })),

  audit_events: validAuditEvents.map((a) => ({
    id: a.id,
    userId: a.userId ?? null,
    projectId: a.projectId ?? null,
    action: a.action,
    metadata: json(a.metadata),
    ipAddress: a.ipAddress ?? null,
    createdAt: a.createdAt,
  })),

  // These source collections were verified empty.
  preview_sessions: [],
  build_results: [],
  project_assets: [],
  provider_configurations: [],
  usage_records: [],
  idempotency_records: [],
};

const excluded = {
  versions: versions.filter((v) => !projectIds.has(v.projectId)),
  files: files.filter((f) => !validFiles.includes(f)),
  generationEvents: events.filter((e) => !validRunIds.has(e.generationRunId)),
  buildLogs: logs.filter((l) => !validRunIds.has(l.generationRunId)),
  sandboxSessions: sessions.filter((s) => !projectIds.has(s.projectId)),
  auditEvents: auditEvents.filter(
    (a) => a.projectId && !projectIds.has(a.projectId)
  ),
};

const summary = Object.fromEntries(
  Object.entries(candidates).map(([table, rows]) => [table, rows.length])
);

const archive = {
  format: "shipshape-json-migration-review-v1",
  generatedAt: new Date().toISOString(),
  sourceFile: ".shipshape-data/store.json",
  sourceSha256: sourceHash,
  policy: "Excluded records are archived for review, not deleted.",
  importSummary: summary,
  excluded,
  unresolvedProjects: projects
    .filter((p) => p.activeVersionId && !versionIds.has(p.activeVersionId))
    .map((p) => ({
      id: p.id,
      name: p.name,
      activeVersionId: p.activeVersionId,
      action: "Preserve the original reference; do not fabricate a version.",
    })),
  warnings: [
    "Review excluded records before deciding whether to import them later.",
    "A valid relationship does not establish that a record is production data.",
    "Legacy ApplicationPlan data is absent; planJson is imported as NULL.",
    "The legacy demo user is not automatically linked to a Clerk identity.",
    "No source records are deleted or modified by this script.",
  ],
};

fs.mkdirSync(archiveDir, { recursive: true });

const archivePath = path.join(
  archiveDir,
  `review-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
);

fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2), {
  flag: "wx",
});

const tables = [
  "users",
  "projects",
  "project_specifications",
  "project_versions",
  "project_files",
  "generation_runs",
  "generation_events",
  "sandbox_sessions",
  "preview_sessions",
  "build_results",
  "build_logs",
  "project_assets",
  "provider_configurations",
  "usage_records",
  "audit_events",
  "idempotency_records",
];

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL,
});

if (!process.env.DIRECT_URL) {
  throw new Error("DIRECT_URL is not configured; check .env.local privately.");
}

const quote = (name) => `"${name}"`;

async function getCounts() {
  const result = {};
  for (const table of tables) {
    const response = await client.query(
      `SELECT COUNT(*)::int AS count FROM public.${quote(table)}`
    );
    result[table] = response.rows[0].count;
  }
  return result;
}

async function insertRows(table, rows) {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);
  const columnSql = columns.map(quote).join(", ");

  for (const row of rows) {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const sql =
      `INSERT INTO public.${quote(table)} (${columnSql}) ` +
      `VALUES (${placeholders})`;

    await client.query(sql, columns.map((column) => row[column]));
  }
}


async function verifyImportedRelationships() {
  const checks = [
    {
      name: "Projects without an existing owner",
      sql: `SELECT COUNT(*)::int AS count
            FROM public.projects p
            LEFT JOIN public.users u ON u.id = p."ownerUserId"
            WHERE u.id IS NULL`,
      expected: 0,
    },
    {
      name: "Files whose version belongs to another project",
      sql: `SELECT COUNT(*)::int AS count
            FROM public.project_files f
            JOIN public.project_versions v ON v.id = f."versionId"
            WHERE f."versionId" IS NOT NULL
              AND f."projectId" <> v."projectId"`,
      expected: 0,
    },
    {
      name: "Generation events without a generation run",
      sql: `SELECT COUNT(*)::int AS count
            FROM public.generation_events e
            LEFT JOIN public.generation_runs r ON r.id = e."generationRunId"
            WHERE r.id IS NULL`,
      expected: 0,
    },
    {
      name: "Build logs without a generation run",
      sql: `SELECT COUNT(*)::int AS count
            FROM public.build_logs l
            LEFT JOIN public.generation_runs r ON r.id = l."generationRunId"
            WHERE r.id IS NULL`,
      expected: 0,
    },
    {
      name: "Sandbox sessions without a project",
      sql: `SELECT COUNT(*)::int AS count
            FROM public.sandbox_sessions s
            LEFT JOIN public.projects p ON p.id = s."projectId"
            WHERE p.id IS NULL`,
      expected: 0,
    },
    {
      name: "Audit events with invalid non-null project references",
      sql: `SELECT COUNT(*)::int AS count
            FROM public.audit_events a
            LEFT JOIN public.projects p ON p.id = a."projectId"
            WHERE a."projectId" IS NOT NULL AND p.id IS NULL`,
      expected: 0,
    },
    {
      name: "Projects not preserving the legacy owner",
      sql: `SELECT COUNT(*)::int AS count
            FROM public.projects
            WHERE "ownerUserId" <> 'usr_default_builder'`,
      expected: 0,
    },
    {
      name: "Legacy user unexpectedly linked to a Clerk identity",
      sql: `SELECT COUNT(*)::int AS count
            FROM public.users
            WHERE id = 'usr_default_builder' AND "clerkId" IS NOT NULL`,
      expected: 0,
    },
  ];

  for (const check of checks) {
    const result = await client.query(check.sql);
    const actual = result.rows[0].count;

    if (actual !== check.expected) {
      throw new Error(
        `Relationship verification failed: ${check.name}; ` +
        `expected ${check.expected}, got ${actual}`
      );
    }

    console.log(`Verified: ${check.name} = ${actual}`);
  }

  const unresolved = await client.query(`
    SELECT p.id, p."activeVersionId"
    FROM public.projects p
    LEFT JOIN public.project_versions v ON v.id = p."activeVersionId"
    WHERE p."activeVersionId" IS NOT NULL AND v.id IS NULL
    ORDER BY p.id
  `);

  const expectedUnresolved = [
    { id: "proj_veloce_crm", activeVersionId: "ver_veloce_v2" },
  ];

  const actualUnresolved = unresolved.rows;

  if (JSON.stringify(actualUnresolved) !== JSON.stringify(expectedUnresolved)) {
    throw new Error(
      "Unresolved active-version references differ from the reviewed baseline: " +
      JSON.stringify(actualUnresolved)
    );
  }

  console.log(
    "Verified: the reviewed AuraCraft active-version reference is preserved."
  );
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
console.log(`Source SHA-256: ${sourceHash}`);
console.log(`Review archive: ${archivePath}`);
console.log("\nCandidate import counts:");
console.log(JSON.stringify(summary, null, 2));
console.log("\nExcluded record counts:");
console.log(JSON.stringify(
  Object.fromEntries(
    Object.entries(excluded).map(([key, rows]) => [key, rows.length])
  ),
  null,
  2
));

try {
  await client.connect();
  const before = await getCounts();

  console.log("\nCurrent Neon application row counts:");
  console.log(JSON.stringify(before, null, 2));

  if (!APPLY) {
    console.log(
      "\nDRY RUN ONLY: no database rows were written. " +
      "Review the counts and archive before approving an import."
    );
  } else {
    const occupied = Object.entries(before).filter(([, count]) => count > 0);

    if (occupied.length) {
      throw new Error(
        "Refusing to import because application tables are not empty: " +
        occupied.map(([table, count]) => `${table}=${count}`).join(", ")
      );
    }

    await client.query("BEGIN");

    try {
      // Insert parents before dependent records.
      const order = [
        "users",
        "projects",
        "project_specifications",
        "project_versions",
        "project_files",
        "generation_runs",
        "generation_events",
        "sandbox_sessions",
        "preview_sessions",
        "build_results",
        "build_logs",
        "project_assets",
        "provider_configurations",
        "usage_records",
        "audit_events",
        "idempotency_records",
      ];

      for (const table of order) {
        await insertRows(table, candidates[table]);
      }

      const after = await getCounts();

      await verifyImportedRelationships();

      for (const table of tables) {
        if (after[table] !== summary[table]) {
          throw new Error(
            `Post-import count mismatch for ${table}: ` +
            `expected ${summary[table]}, got ${after[table]}`
          );
        }
      }

      await client.query("COMMIT");

      console.log("\nImport transaction committed.");
      console.log("Verified database counts:");
      console.log(JSON.stringify(after, null, 2));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
