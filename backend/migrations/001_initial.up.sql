-- 001_initial.up.sql
-- Initial PostgreSQL schema.
-- Every tenant-owned table carries organization_id for tenant isolation (§37).

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  application_name TEXT NOT NULL,
  application_version TEXT NOT NULL,
  version_strategy TEXT NOT NULL,
  bom_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  error_code TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  bulk_scan_id TEXT,
  bulk_row INTEGER NOT NULL DEFAULT 0,
  snapshot_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_scans_org ON scans(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_app ON scans(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_bulk ON scans(bulk_scan_id);

CREATE TABLE IF NOT EXISTS scan_jobs (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  bom_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  error_code TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS scan_events (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scan_events_scan ON scan_events(scan_id, created_at);

CREATE TABLE IF NOT EXISTS bom_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  scan_id TEXT NOT NULL,
  bom_type TEXT NOT NULL,
  application_version TEXT NOT NULL,
  version_strategy TEXT NOT NULL,
  repository_url TEXT NOT NULL DEFAULT '',
  repository_branch TEXT NOT NULL DEFAULT '',
  commit_sha TEXT NOT NULL DEFAULT '',
  commit_author TEXT NOT NULL DEFAULT '',
  commit_email TEXT NOT NULL DEFAULT '',
  commit_message TEXT NOT NULL DEFAULT '',
  scanner_name TEXT NOT NULL,
  scanner_version TEXT NOT NULL,
  bom_format_version TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL,
  raw_metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_bom_app ON bom_snapshots(application_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bom_scan ON bom_snapshots(scan_id);

CREATE TABLE IF NOT EXISTS bom_components (
  id TEXT PRIMARY KEY,
  bom_snapshot_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  ecosystem TEXT NOT NULL,
  package_manager TEXT NOT NULL DEFAULT '',
  purl TEXT NOT NULL DEFAULT '',
  cpe TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'runtime',
  direct_dependency BOOLEAN NOT NULL DEFAULT FALSE,
  source_manifest TEXT NOT NULL DEFAULT '',
  raw TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comp_snapshot ON bom_components(bom_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_comp_purl ON bom_components(purl);
CREATE INDEX IF NOT EXISTS idx_comp_name_version ON bom_components(name, version);

CREATE TABLE IF NOT EXISTS bom_dependencies (
  id TEXT PRIMARY KEY,
  bom_snapshot_id TEXT NOT NULL,
  from_component_id TEXT NOT NULL,
  to_component_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'runtime'
);
CREATE INDEX IF NOT EXISTS idx_dep_snapshot ON bom_dependencies(bom_snapshot_id);

CREATE TABLE IF NOT EXISTS git_credentials (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  credential_type TEXT NOT NULL,
  name TEXT NOT NULL,
  secret_reference TEXT NOT NULL,
  repository_scope TEXT NOT NULL DEFAULT '*',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_validated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS credential_secrets (
  reference TEXT PRIMARY KEY,
  nonce BYTEA NOT NULL,
  ciphertext BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  url TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT '',
  private BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, url)
);

CREATE TABLE IF NOT EXISTS repository_connections (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  credential_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bulk_scans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  validation_errors TEXT
);

CREATE TABLE IF NOT EXISTS bulk_scan_items (
  id TEXT PRIMARY KEY,
  bulk_scan_id TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  scan_id TEXT,
  project_name TEXT NOT NULL,
  application_name TEXT NOT NULL,
  version TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS vulnerabilities (
  id TEXT PRIMARY KEY,
  vulnerability_id TEXT NOT NULL,
  source TEXT NOT NULL,
  severity TEXT NOT NULL,
  cvss_score REAL,
  cvss_vector TEXT,
  description TEXT,
  published_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  refs TEXT,
  UNIQUE (source, vulnerability_id)
);

CREATE TABLE IF NOT EXISTS component_vulnerabilities (
  component_id TEXT NOT NULL,
  vulnerability_id TEXT NOT NULL,
  affected_version TEXT,
  fixed_version TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (component_id, vulnerability_id)
);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL,
  object_key TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  delivery_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (provider, delivery_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  organization_id TEXT,
  actor_id TEXT,
  scan_id TEXT,
  credential_id TEXT,
  repository TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS scanner_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  commit_sha TEXT,
  released_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
