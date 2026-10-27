-- PostgreSQL DDL for Shipshape AI-Powered Full-Stack Application Builder
-- Corresponds to schema.prisma for production PostgreSQL instances

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY,
    owner_user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    active_version_id VARCHAR(36),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_user_id);

CREATE TABLE IF NOT EXISTS project_specifications (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_number INTEGER DEFAULT 1,
    specification_json TEXT NOT NULL,
    plan_json TEXT NOT NULL,
    schema_version VARCHAR(20) DEFAULT '1.0.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_specifications_project ON project_specifications(project_id);

CREATE TABLE IF NOT EXISTS project_versions (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_version_id VARCHAR(36),
    version_number INTEGER DEFAULT 1,
    source_manifest TEXT NOT NULL,
    snapshot_reference TEXT,
    change_summary TEXT,
    validation_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_versions_project ON project_versions(project_id);

CREATE TABLE IF NOT EXISTS project_files (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_id VARCHAR(36) REFERENCES project_versions(id) ON DELETE SET NULL,
    path VARCHAR(512) NOT NULL,
    content TEXT NOT NULL,
    size_bytes INTEGER DEFAULT 0,
    mime_type VARCHAR(100) DEFAULT 'text/plain',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_project_file UNIQUE (project_id, version_id, path)
);
CREATE INDEX IF NOT EXISTS idx_project_files_lookup ON project_files(project_id, path);

CREATE TABLE IF NOT EXISTS generation_runs (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    base_version_id VARCHAR(36),
    result_version_id VARCHAR(36),
    run_type VARCHAR(50) DEFAULT 'generation',
    status VARCHAR(50) DEFAULT 'queued',
    model_provider VARCHAR(50) DEFAULT 'deterministic',
    model_identifier VARCHAR(100) DEFAULT 'gemini-1.5-pro',
    attempt_count INTEGER DEFAULT 1,
    prompt TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE,
    error_code VARCHAR(100),
    error_message TEXT,
    usage_metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_generation_runs_project ON generation_runs(project_id);

CREATE TABLE IF NOT EXISTS generation_events (
    id VARCHAR(36) PRIMARY KEY,
    generation_run_id VARCHAR(36) NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_generation_events_run_seq ON generation_events(generation_run_id, sequence_number);

CREATE TABLE IF NOT EXISTS sandbox_sessions (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider_key VARCHAR(50) DEFAULT 'isolated_node',
    external_sandbox_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'created',
    port INTEGER,
    host_url TEXT,
    workspace_dir TEXT,
    pid INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    terminated_at TIMESTAMP WITH TIME ZONE,
    error_code VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_project ON sandbox_sessions(project_id);

CREATE TABLE IF NOT EXISTS preview_sessions (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sandbox_session_id VARCHAR(36) NOT NULL REFERENCES sandbox_sessions(id) ON DELETE CASCADE,
    preview_url TEXT NOT NULL,
    isolation_origin VARCHAR(100) DEFAULT 'sandbox',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_preview_sessions_project ON preview_sessions(project_id);

CREATE TABLE IF NOT EXISTS build_results (
    id VARCHAR(36) PRIMARY KEY,
    generation_run_id VARCHAR(36) NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
    project_version_id VARCHAR(36) REFERENCES project_versions(id) ON DELETE SET NULL,
    check_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    exit_code INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    log_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_build_results_run ON build_results(generation_run_id);

CREATE TABLE IF NOT EXISTS build_logs (
    id VARCHAR(36) PRIMARY KEY,
    generation_run_id VARCHAR(36) NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
    stream_type VARCHAR(20) DEFAULT 'stdout',
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_build_logs_run ON build_logs(generation_run_id);

CREATE TABLE IF NOT EXISTS project_assets (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    size_bytes INTEGER DEFAULT 0,
    mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_assets_project ON project_assets(project_id);

CREATE TABLE IF NOT EXISTS provider_configurations (
    id VARCHAR(36) PRIMARY KEY,
    provider_type VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    config_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usage_records (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    generation_run_id VARCHAR(36) REFERENCES generation_runs(id) ON DELETE SET NULL,
    tokens_used INTEGER DEFAULT 0,
    execution_seconds REAL DEFAULT 0.0,
    storage_bytes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_usage_records_project ON usage_records(project_id);

CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    metadata TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_events_project ON audit_events(project_id);

CREATE TABLE IF NOT EXISTS idempotency_records (
    id VARCHAR(36) PRIMARY KEY,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    response_payload TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
