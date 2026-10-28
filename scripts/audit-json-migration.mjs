import fs from "node:fs";
import crypto from "node:crypto";

const source = ".shipshape-data/store.json";

if (!fs.existsSync(source)) {
  throw new Error(`Source JSON store not found: ${source}`);
}

const store = JSON.parse(fs.readFileSync(source, "utf8"));

const values = (value) =>
  Array.isArray(value) ? value : Object.values(value ?? {});

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
const _runIds = new Set(runs.map((item) => item.id));

const validVersions = versions.filter(
  (item) => projectIds.has(item.projectId)
);

const validVersionIds = new Set(validVersions.map((item) => item.id));

const validFiles = files.filter(
  (item) =>
    projectIds.has(item.projectId) &&
    item.versionId &&
    validVersionIds.has(item.versionId) &&
    versions.some(
      (version) =>
        version.id === item.versionId &&
        version.projectId === item.projectId
    )
);

const validRuns = runs.filter(
  (item) => projectIds.has(item.projectId)
);
const validRunIds = new Set(validRuns.map((item) => item.id));

const validEvents = events.filter(
  (item) => validRunIds.has(item.generationRunId)
);
const validLogs = logs.filter(
  (item) => validRunIds.has(item.generationRunId)
);

const validSessions = sessions.filter(
  (item) => projectIds.has(item.projectId)
);

const validAuditEvents = auditEvents.filter(
  (item) => !item.projectId || projectIds.has(item.projectId)
);

const counts = {
  users: users.length,
  projects: projects.length,
  specifications: specifications.length,
  versions: versions.length,
  versionsWithExistingProjects: validVersions.length,
  files: files.length,
  filesWithConsistentProjectAndVersion: validFiles.length,
  generationRuns: runs.length,
  generationEvents: events.length,
  eventsForExistingRuns: validEvents.length,
  buildLogs: logs.length,
  logsForExistingRuns: validLogs.length,
  sandboxSessions: sessions.length,
  sessionsForExistingProjects: validSessions.length,
  auditEvents: auditEvents.length,
  auditEventsWithValidProjectReferences: validAuditEvents.length,
};

const archive = {
  format: "shipshape-json-migration-review-v1",
  generatedAt: new Date().toISOString(),
  sourceFile: source,
  sourceSha256: crypto
    .createHash("sha256")
    .update(fs.readFileSync(source))
    .digest("hex"),
  policy: "Review archive only; no source or database mutation.",
  excludedOrUnresolved: {
    versions: versions.filter((item) => !projectIds.has(item.projectId)),
    files: files.filter((item) => !validFiles.includes(item)),
    generationEvents: events.filter(
      (item) => !validRunIds.has(item.generationRunId)
    ),
    buildLogs: logs.filter(
      (item) => !validRunIds.has(item.generationRunId)
    ),
    sandboxSessions: sessions.filter(
      (item) => !projectIds.has(item.projectId)
    ),
    auditEvents: auditEvents.filter(
      (item) => item.projectId && !projectIds.has(item.projectId)
    ),
  },
  warnings: [
    "This archive does not authorize deletion of source records.",
    "A valid project reference does not prove a record is production data.",
    "Files whose project/version references disagree require manual review.",
    "Plans are not present in the source specification records.",
    "Projects with unresolved activeVersionId values must retain those values.",
  ],
};

console.log("SHIPSHAPE JSON MIGRATION AUDIT");
console.log("==============================");
console.log(JSON.stringify(counts, null, 2));
console.log("\nPROJECTS");
for (const project of projects) {
  console.log(JSON.stringify({
    id: project.id,
    name: project.name,
    ownerUserId: project.ownerUserId,
    activeVersionId: project.activeVersionId ?? null,
    activeVersionExists: project.activeVersionId
      ? versionIds.has(project.activeVersionId)
      : null,
  }));
}
console.log("\nSource SHA-256:", archive.sourceSha256);
console.log("Read-only audit complete. No files or database rows changed.");
