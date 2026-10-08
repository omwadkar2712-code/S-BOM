-- Scan pipeline. One security-scans record per organization owns every scan table.
-- Software inventory lives in 004_software_inventory.up.sql.
--
-- tbl_organizations
--   └── tbl_security_scans
--         ├── tbl_scan_runs
--         │     ├── tbl_scan_jobs
--         │     ├── tbl_scan_events
--         │     └── tbl_bom_snapshots
--         │           ├── tbl_bom_components
--         │           └── tbl_bom_dependencies
--         ├── tbl_bulk_scans
--         │     └── tbl_bulk_scan_items
--         ├── tbl_git_credentials
--         │     └── tbl_credential_secrets
--         ├── tbl_webhook_events
--         └── tbl_audit_logs

CREATE TABLE IF NOT EXISTS tbl_organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_security_scans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Security scans',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id),
  UNIQUE (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES tbl_organizations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tbl_bulk_scans (
  id TEXT PRIMARY KEY,
  security_scans_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  bulk_status TEXT NOT NULL,
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  validation_errors TEXT,
  UNIQUE (id, organization_id),
  FOREIGN KEY (security_scans_id, organization_id)
    REFERENCES tbl_security_scans (id, organization_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tbl_scan_runs (
  id TEXT PRIMARY KEY,
  security_scans_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  application_name TEXT NOT NULL,
  application_version TEXT NOT NULL,
  version_strategy TEXT NOT NULL,
  bom_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  scan_status TEXT NOT NULL,
  scan_stage TEXT NOT NULL,
  error_code TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  bulk_scan_id TEXT,
  bulk_row_number INTEGER NOT NULL DEFAULT 0,
  bom_snapshot_id TEXT,
  UNIQUE (id, organization_id),
  UNIQUE (id, security_scans_id),
  UNIQUE (id, security_scans_id, organization_id),
  FOREIGN KEY (security_scans_id, organization_id)
    REFERENCES tbl_security_scans (id, organization_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scan_runs_organization
  ON tbl_scan_runs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_runs_application
  ON tbl_scan_runs (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_runs_bulk
  ON tbl_scan_runs (bulk_scan_id);

CREATE TABLE IF NOT EXISTS tbl_scan_jobs (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL,
  security_scans_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  bom_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  job_status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  job_payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  error_code TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  FOREIGN KEY (scan_run_id, security_scans_id, organization_id)
    REFERENCES tbl_scan_runs (id, security_scans_id, organization_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_status
  ON tbl_scan_jobs (job_status, next_attempt_at);

CREATE TABLE IF NOT EXISTS tbl_scan_events (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL,
  security_scans_id TEXT NOT NULL,
  scan_stage TEXT NOT NULL,
  event_message TEXT NOT NULL,
  event_data TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (scan_run_id, security_scans_id)
    REFERENCES tbl_scan_runs (id, security_scans_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scan_events_scan
  ON tbl_scan_events (scan_run_id, created_at);

CREATE TABLE IF NOT EXISTS tbl_bom_snapshots (
  id TEXT PRIMARY KEY,
  security_scans_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  scan_run_id TEXT NOT NULL,
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
  raw_metadata TEXT,
  UNIQUE (id, security_scans_id),
  FOREIGN KEY (scan_run_id, security_scans_id, organization_id)
    REFERENCES tbl_scan_runs (id, security_scans_id, organization_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bom_snapshots_application
  ON tbl_bom_snapshots (application_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bom_snapshots_scan
  ON tbl_bom_snapshots (scan_run_id);

CREATE TABLE IF NOT EXISTS tbl_bom_components (
  id TEXT PRIMARY KEY,
  bom_snapshot_id TEXT NOT NULL,
  component_name TEXT NOT NULL,
  component_version TEXT NOT NULL,
  ecosystem TEXT NOT NULL,
  package_manager TEXT NOT NULL DEFAULT '',
  package_url TEXT NOT NULL DEFAULT '',
  cpe TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  license_name TEXT NOT NULL DEFAULT '',
  supplier_name TEXT NOT NULL DEFAULT '',
  dependency_scope TEXT NOT NULL DEFAULT 'runtime',
  is_direct_dependency BOOLEAN NOT NULL DEFAULT FALSE,
  source_manifest TEXT NOT NULL DEFAULT '',
  raw_component TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (id, bom_snapshot_id),
  FOREIGN KEY (bom_snapshot_id) REFERENCES tbl_bom_snapshots (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bom_components_snapshot
  ON tbl_bom_components (bom_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_bom_components_package_url
  ON tbl_bom_components (package_url);
CREATE INDEX IF NOT EXISTS idx_bom_components_name_version
  ON tbl_bom_components (component_name, component_version);

CREATE TABLE IF NOT EXISTS tbl_bom_dependencies (
  id TEXT PRIMARY KEY,
  bom_snapshot_id TEXT NOT NULL,
  from_component_id TEXT NOT NULL,
  to_component_id TEXT NOT NULL,
  dependency_kind TEXT NOT NULL DEFAULT 'runtime',
  FOREIGN KEY (bom_snapshot_id) REFERENCES tbl_bom_snapshots (id) ON DELETE CASCADE,
  FOREIGN KEY (from_component_id, bom_snapshot_id)
    REFERENCES tbl_bom_components (id, bom_snapshot_id) ON DELETE CASCADE,
  FOREIGN KEY (to_component_id, bom_snapshot_id)
    REFERENCES tbl_bom_components (id, bom_snapshot_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bom_dependencies_snapshot
  ON tbl_bom_dependencies (bom_snapshot_id);

CREATE TABLE IF NOT EXISTS tbl_credential_secrets (
  secret_reference TEXT PRIMARY KEY,
  nonce BYTEA NOT NULL,
  ciphertext BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS tbl_git_credentials (
  id TEXT PRIMARY KEY,
  security_scans_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  credential_type TEXT NOT NULL,
  credential_name TEXT NOT NULL,
  secret_reference TEXT,
  repository_scope TEXT NOT NULL DEFAULT '*',
  credential_status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_validated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  UNIQUE (id, organization_id),
  FOREIGN KEY (security_scans_id, organization_id)
    REFERENCES tbl_security_scans (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (secret_reference) REFERENCES tbl_credential_secrets (secret_reference) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tbl_bulk_scan_items (
  id TEXT PRIMARY KEY,
  bulk_scan_id TEXT NOT NULL,
  source_row_number INTEGER NOT NULL,
  scan_run_id TEXT,
  project_name TEXT NOT NULL,
  application_name TEXT NOT NULL,
  application_version TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  item_status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  FOREIGN KEY (bulk_scan_id) REFERENCES tbl_bulk_scans (id) ON DELETE CASCADE,
  FOREIGN KEY (scan_run_id) REFERENCES tbl_scan_runs (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bulk_scan_items_bulk
  ON tbl_bulk_scan_items (bulk_scan_id, source_row_number);

CREATE TABLE IF NOT EXISTS tbl_webhook_events (
  id TEXT PRIMARY KEY,
  security_scans_id TEXT,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  delivery_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  is_processed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (provider, delivery_id),
  FOREIGN KEY (security_scans_id) REFERENCES tbl_security_scans (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tbl_audit_logs (
  id TEXT PRIMARY KEY,
  audit_kind TEXT NOT NULL,
  security_scans_id TEXT,
  organization_id TEXT,
  actor_id TEXT,
  scan_run_id TEXT,
  credential_id TEXT,
  repository_name TEXT,
  audit_metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (security_scans_id) REFERENCES tbl_security_scans (id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES tbl_organizations (id) ON DELETE SET NULL,
  FOREIGN KEY (scan_run_id) REFERENCES tbl_scan_runs (id) ON DELETE SET NULL,
  FOREIGN KEY (credential_id) REFERENCES tbl_git_credentials (id) ON DELETE SET NULL
);

ALTER TABLE tbl_scan_runs DROP CONSTRAINT IF EXISTS fk_scan_runs_bulk_scan;
ALTER TABLE tbl_scan_runs
  ADD CONSTRAINT fk_scan_runs_bulk_scan
  FOREIGN KEY (bulk_scan_id, organization_id)
  REFERENCES tbl_bulk_scans (id, organization_id) ON DELETE SET NULL (bulk_scan_id);

ALTER TABLE tbl_scan_runs DROP CONSTRAINT IF EXISTS fk_scan_runs_bom_snapshot;
ALTER TABLE tbl_scan_runs
  ADD CONSTRAINT fk_scan_runs_bom_snapshot
  FOREIGN KEY (bom_snapshot_id) REFERENCES tbl_bom_snapshots (id) ON DELETE SET NULL;

COMMENT ON TABLE tbl_security_scans IS 'One security-scans record per organization. Scan runs, jobs, SBOM snapshots, bulk uploads, credentials, webhooks, and audit rows belong to it.';
COMMENT ON TABLE tbl_scan_runs IS 'One scan execution. Project and application labels stay here because a scan can be requested before those catalog rows exist.';
COMMENT ON TABLE tbl_scan_jobs IS 'Queue row for one scan run.';
COMMENT ON TABLE tbl_scan_events IS 'Progress messages for one scan run.';
COMMENT ON TABLE tbl_bom_snapshots IS 'Finished SBOM header produced by one scan run.';
COMMENT ON TABLE tbl_bom_components IS 'Packages found inside one SBOM snapshot.';
COMMENT ON TABLE tbl_bom_dependencies IS 'Dependency edge between two packages in the same snapshot.';
COMMENT ON TABLE tbl_bulk_scans IS 'One uploaded spreadsheet that starts many scan runs.';
COMMENT ON TABLE tbl_bulk_scan_items IS 'One spreadsheet row and the scan run it created.';
COMMENT ON TABLE tbl_git_credentials IS 'Git login used to clone a repository for a scan.';
COMMENT ON TABLE tbl_credential_secrets IS 'Encrypted secret bytes. A credential points at one row.';
COMMENT ON TABLE tbl_webhook_events IS 'Inbound Git provider delivery. Linked to the organization security-scans record when the request has an organization.';
COMMENT ON TABLE tbl_audit_logs IS 'Who did what. Points at the scan run or credential when that row still exists.';
