-- Ten tables. Earlier migrations recreate the tbl_* tables on startup;
-- this file copies their rows into the ten tables, then drops the tbl_* tables.
--
-- organizations
--   ├── projects
--   │     └── applications
--   │           └── inventory_components
--   ├── credentials
--   └── scans
--         └── sboms
--               └── sbom_components
--                     └── findings
--                           └── vulnerabilities

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, name),
  UNIQUE (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, project_id, name),
  UNIQUE (id, project_id, organization_id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id) ON DELETE CASCADE,
  CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS inventory_components (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  version TEXT NOT NULL,
  component_type TEXT NOT NULL DEFAULT 'Library',
  source_file_name TEXT NOT NULL DEFAULT '',
  license_name TEXT NOT NULL DEFAULT 'Unknown',
  package_url TEXT NOT NULL DEFAULT '',
  ecosystem TEXT NOT NULL DEFAULT 'npm',
  risk_level TEXT NOT NULL DEFAULT 'Safe',
  vulnerability_count INTEGER NOT NULL DEFAULT 0,
  is_direct_dependency BOOLEAN NOT NULL DEFAULT TRUE,
  supplier_name TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (application_id, project_id, organization_id)
    REFERENCES applications (id, project_id, organization_id) ON DELETE CASCADE,
  CHECK (length(btrim(name)) > 0),
  CHECK (length(btrim(version)) > 0),
  CHECK (vulnerability_count >= 0)
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  credential_type TEXT NOT NULL,
  name TEXT NOT NULL,
  secret_reference TEXT,
  secret_nonce BYTEA,
  secret_ciphertext BYTEA,
  repository_scope TEXT NOT NULL DEFAULT '*',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_validated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT '',
  application_id TEXT NOT NULL DEFAULT '',
  application_name TEXT NOT NULL DEFAULT '',
  application_version TEXT NOT NULL DEFAULT '',
  version_strategy TEXT NOT NULL DEFAULT '',
  bom_type TEXT NOT NULL DEFAULT 'SBOM',
  source_type TEXT NOT NULL DEFAULT '',
  scan_status TEXT NOT NULL,
  scan_stage TEXT NOT NULL DEFAULT '',
  error_code TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  bulk_scan_id TEXT,
  bulk_row_number INTEGER NOT NULL DEFAULT 0,
  bulk_file_name TEXT NOT NULL DEFAULT '',
  bulk_status TEXT NOT NULL DEFAULT '',
  bulk_total_rows INTEGER NOT NULL DEFAULT 0,
  bulk_invalid_rows INTEGER NOT NULL DEFAULT 0,
  bulk_errors TEXT,
  sbom_id TEXT,
  catalog_project_id TEXT,
  catalog_application_id TEXT,
  repository_url TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  job_status TEXT NOT NULL DEFAULT '',
  job_payload TEXT NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ,
  job_started_at TIMESTAMPTZ,
  job_completed_at TIMESTAMPTZ,
  job_error_code TEXT NOT NULL DEFAULT '',
  job_error_message TEXT NOT NULL DEFAULT '',
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sboms (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT '',
  application_id TEXT NOT NULL DEFAULT '',
  scan_id TEXT NOT NULL,
  catalog_project_id TEXT,
  catalog_application_id TEXT,
  bom_type TEXT NOT NULL,
  application_version TEXT NOT NULL DEFAULT '',
  version_strategy TEXT NOT NULL DEFAULT '',
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
  file_name TEXT NOT NULL DEFAULT '',
  file_format TEXT NOT NULL DEFAULT '',
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  signature_status TEXT NOT NULL DEFAULT '',
  facts_normalized BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  FOREIGN KEY (scan_id) REFERENCES scans (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sbom_components (
  id TEXT PRIMARY KEY,
  sbom_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
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
  dependency_depth INTEGER,
  ntia_supplier BOOLEAN,
  ntia_name BOOLEAN,
  ntia_version BOOLEAN,
  ntia_identifier BOOLEAN,
  ntia_relationship BOOLEAN,
  ntia_author BOOLEAN,
  ntia_timestamp BOOLEAN,
  depends_on TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (id, sbom_id),
  FOREIGN KEY (sbom_id) REFERENCES sboms (id) ON DELETE CASCADE,
  CHECK (dependency_depth IS NULL OR dependency_depth >= 0)
);

CREATE TABLE IF NOT EXISTS vulnerabilities (
  id TEXT PRIMARY KEY,
  vulnerability_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'UNKNOWN',
  cvss_score NUMERIC(4,1) NOT NULL DEFAULT 0,
  cvss_vector TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  reference_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')),
  CHECK (cvss_score >= 0 AND cvss_score <= 10)
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  sbom_id TEXT NOT NULL,
  sbom_component_id TEXT NOT NULL,
  vulnerability_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'UNKNOWN',
  cvss_score NUMERIC(4,1) NOT NULL DEFAULT 0,
  cvss_vector TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  fixed_version TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (sbom_component_id, vulnerability_id),
  FOREIGN KEY (sbom_id) REFERENCES sboms (id) ON DELETE CASCADE,
  FOREIGN KEY (sbom_component_id, sbom_id) REFERENCES sbom_components (id, sbom_id) ON DELETE CASCADE,
  FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities (id) ON DELETE RESTRICT,
  CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')),
  CHECK (cvss_score >= 0 AND cvss_score <= 10)
);

-- Rebuild parent rows if an older startup dropped them while child rows remained.
INSERT INTO organizations (id, name)
SELECT DISTINCT organization_id, organization_id FROM sboms
WHERE btrim(COALESCE(organization_id, '')) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name)
SELECT DISTINCT organization_id, organization_id FROM inventory_components
WHERE btrim(COALESCE(organization_id, '')) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, organization_id, name)
SELECT DISTINCT catalog_project_id, organization_id, left(btrim(project_id), 200)
FROM sboms
WHERE catalog_project_id IS NOT NULL AND btrim(COALESCE(project_id, '')) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO applications (id, project_id, organization_id, name)
SELECT DISTINCT catalog_application_id, catalog_project_id, organization_id, left(btrim(application_id), 200)
FROM sboms
WHERE catalog_application_id IS NOT NULL
  AND catalog_project_id IS NOT NULL
  AND btrim(COALESCE(application_id, '')) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, organization_id, name)
SELECT DISTINCT project_id, organization_id, 'Recovered ' || project_id
FROM inventory_components
WHERE project_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = inventory_components.project_id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO applications (id, project_id, organization_id, name)
SELECT DISTINCT application_id, project_id, organization_id, 'Recovered ' || application_id
FROM inventory_components
WHERE application_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.id = inventory_components.application_id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO scans (
  id, organization_id, project_id, application_id, application_name, application_version,
  version_strategy, bom_type, source_type, scan_status, scan_stage, idempotency_key,
  created_at, completed_at, sbom_id, catalog_project_id, catalog_application_id,
  repository_url, branch
)
SELECT
  s.scan_id, s.organization_id, COALESCE(s.project_id, ''), COALESCE(s.application_id, ''),
  COALESCE(s.application_id, ''), COALESCE(s.application_version, ''),
  COALESCE(s.version_strategy, ''), COALESCE(s.bom_type, 'SBOM'),
  CASE WHEN btrim(COALESCE(s.repository_url, '')) <> '' THEN 'GITHUB' ELSE 'LOCAL' END,
  'COMPLETED', 'COMPLETED', 'recovered:' || s.scan_id,
  s.generated_at, s.generated_at, s.id,
  CASE WHEN p.id IS NOT NULL THEN s.catalog_project_id ELSE NULL END,
  CASE WHEN a.id IS NOT NULL AND p.id IS NOT NULL THEN s.catalog_application_id ELSE NULL END,
  COALESCE(s.repository_url, ''), COALESCE(s.repository_branch, '')
FROM sboms s
LEFT JOIN projects p ON p.id = s.catalog_project_id AND p.organization_id = s.organization_id
LEFT JOIN applications a
  ON a.id = s.catalog_application_id AND a.project_id = s.catalog_project_id AND a.organization_id = s.organization_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO vulnerabilities (
  id, vulnerability_key, source, severity, cvss_score, cvss_vector, description
)
SELECT DISTINCT ON (vulnerability_id)
  vulnerability_id, vulnerability_id, source, severity, cvss_score, cvss_vector, description
FROM findings
ORDER BY vulnerability_id
ON CONFLICT (id) DO NOTHING;

UPDATE vulnerabilities AS v
SET vulnerability_key = matched.cve
FROM (
  SELECT f.vulnerability_id, min(elem->>'id') AS cve
  FROM findings f
  JOIN sbom_components c ON c.id = f.sbom_component_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(sbom_jsonb(c.raw_component)->'vulnerabilities') = 'array'
        THEN sbom_jsonb(c.raw_component)->'vulnerabilities'
      ELSE '[]'::jsonb
    END
  ) AS elem
  WHERE btrim(COALESCE(elem->>'id', '')) <> ''
    AND COALESCE(elem->>'fixed_version', '') = f.fixed_version
    AND upper(COALESCE(elem->>'severity', '')) = f.severity
  GROUP BY f.vulnerability_id
  HAVING COUNT(DISTINCT elem->>'id') = 1
) AS matched
WHERE v.id = matched.vulnerability_id
  AND v.vulnerability_key = v.id
  AND NOT EXISTS (
    SELECT 1 FROM vulnerabilities other
    WHERE other.vulnerability_key = matched.cve AND other.id <> v.id
  );

UPDATE sboms AS s
SET catalog_project_id = NULL
WHERE catalog_project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = s.catalog_project_id AND p.organization_id = s.organization_id
  );

UPDATE sboms AS s
SET catalog_application_id = NULL
WHERE catalog_application_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM applications a
    WHERE a.id = s.catalog_application_id
      AND a.project_id = s.catalog_project_id
      AND a.organization_id = s.organization_id
  );

UPDATE scans AS s
SET catalog_project_id = NULL
WHERE catalog_project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = s.catalog_project_id AND p.organization_id = s.organization_id
  );

UPDATE scans AS s
SET catalog_application_id = NULL
WHERE catalog_application_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM applications a
    WHERE a.id = s.catalog_application_id
      AND a.project_id = s.catalog_project_id
      AND a.organization_id = s.organization_id
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_credentials_organization') THEN
    ALTER TABLE credentials
      ADD CONSTRAINT fk_credentials_organization
      FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventory_organization') THEN
    ALTER TABLE inventory_components
      ADD CONSTRAINT fk_inventory_organization
      FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventory_project') THEN
    ALTER TABLE inventory_components
      ADD CONSTRAINT fk_inventory_project
      FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventory_application') THEN
    ALTER TABLE inventory_components
      ADD CONSTRAINT fk_inventory_application
      FOREIGN KEY (application_id, project_id, organization_id)
      REFERENCES applications (id, project_id, organization_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sboms_organization') THEN
    ALTER TABLE sboms
      ADD CONSTRAINT fk_sboms_organization
      FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sboms_scan') THEN
    ALTER TABLE sboms
      ADD CONSTRAINT fk_sboms_scan
      FOREIGN KEY (scan_id) REFERENCES scans (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_findings_vulnerability') THEN
    ALTER TABLE findings
      ADD CONSTRAINT fk_findings_vulnerability
      FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities (id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scans_catalog_project') THEN
    ALTER TABLE scans
      ADD CONSTRAINT fk_scans_catalog_project
      FOREIGN KEY (catalog_project_id, organization_id)
      REFERENCES projects (id, organization_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scans_catalog_application') THEN
    ALTER TABLE scans
      ADD CONSTRAINT fk_scans_catalog_application
      FOREIGN KEY (catalog_application_id, catalog_project_id, organization_id)
      REFERENCES applications (id, project_id, organization_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scans_sbom') THEN
    ALTER TABLE scans
      ADD CONSTRAINT fk_scans_sbom
      FOREIGN KEY (sbom_id) REFERENCES sboms (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sboms_catalog_project') THEN
    ALTER TABLE sboms
      ADD CONSTRAINT fk_sboms_catalog_project
      FOREIGN KEY (catalog_project_id, organization_id)
      REFERENCES projects (id, organization_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sboms_catalog_application') THEN
    ALTER TABLE sboms
      ADD CONSTRAINT fk_sboms_catalog_application
      FOREIGN KEY (catalog_application_id, catalog_project_id, organization_id)
      REFERENCES applications (id, project_id, organization_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects (organization_id, name);
CREATE INDEX IF NOT EXISTS idx_applications_project ON applications (project_id, name);
CREATE INDEX IF NOT EXISTS idx_inventory_components_organization ON inventory_components (organization_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_components_application ON inventory_components (application_id);
CREATE INDEX IF NOT EXISTS idx_credentials_organization ON credentials (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_organization ON scans (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_job_queue ON scans (job_status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_scans_bulk ON scans (bulk_scan_id, bulk_row_number);
CREATE INDEX IF NOT EXISTS idx_sboms_scan ON sboms (scan_id);
CREATE INDEX IF NOT EXISTS idx_sboms_application ON sboms (application_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sbom_components_sbom ON sbom_components (sbom_id);
CREATE INDEX IF NOT EXISTS idx_sbom_components_name ON sbom_components (name, version);
CREATE INDEX IF NOT EXISTS idx_findings_sbom ON findings (sbom_id);
CREATE INDEX IF NOT EXISTS idx_findings_vulnerability ON findings (vulnerability_id);

INSERT INTO organizations (id, name, created_at)
SELECT id, name, created_at FROM tbl_organizations
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, organization_id, name, created_at, updated_at)
SELECT id, organization_id, project_name, created_at, updated_at
FROM tbl_projects_and_microservices
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO applications (id, project_id, organization_id, name, created_at)
SELECT id, project_id, organization_id, service_name, created_at
FROM tbl_project_applications_and_services
ON CONFLICT (organization_id, project_id, name) DO NOTHING;

INSERT INTO inventory_components (
  id, organization_id, project_id, application_id, name, package_name, version,
  component_type, source_file_name, license_name, package_url, ecosystem, risk_level,
  vulnerability_count, is_direct_dependency, supplier_name, created_by, created_at
)
SELECT
  c.id, c.organization_id, c.project_id, c.service_id, c.component_name, c.package_name, c.version,
  c.component_type, c.source_file_name, c.license_name, c.package_url, c.ecosystem, c.risk_level,
  c.vulnerability_count, c.is_direct_dependency, c.supplier_name, c.created_by, c.created_at
FROM tbl_software_components_and_packages c
JOIN applications a
  ON a.id = c.service_id AND a.project_id = c.project_id AND a.organization_id = c.organization_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO credentials (
  id, organization_id, provider, credential_type, name, secret_reference,
  secret_nonce, secret_ciphertext, repository_scope, status, created_at, updated_at,
  last_validated_at, expires_at
)
SELECT
  g.id, g.organization_id, g.provider, g.credential_type, g.credential_name, g.secret_reference,
  s.nonce, s.ciphertext, g.repository_scope, g.credential_status, g.created_at, g.updated_at,
  g.last_validated_at, g.expires_at
FROM tbl_git_credentials g
LEFT JOIN tbl_credential_secrets s ON s.secret_reference = g.secret_reference
ON CONFLICT (id) DO NOTHING;

INSERT INTO scans (
  id, organization_id, project_id, application_id, application_name, application_version,
  version_strategy, bom_type, source_type, scan_status, scan_stage, error_code, error_message,
  idempotency_key, created_at, started_at, completed_at, bulk_scan_id, bulk_row_number,
  bulk_file_name, bulk_status, bulk_total_rows, bulk_invalid_rows, bulk_errors,
  catalog_project_id, catalog_application_id, repository_url, branch,
  job_status, job_payload, priority, attempts, max_attempts, next_attempt_at,
  job_started_at, job_completed_at, job_error_code, job_error_message, events
)
SELECT
  r.id, r.organization_id, r.project_id, r.application_id, r.application_name, r.application_version,
  r.version_strategy, r.bom_type, r.source_type, r.scan_status, r.scan_stage, r.error_code, r.error_message,
  r.idempotency_key, r.created_at, r.started_at, r.completed_at, NULLIF(r.bulk_scan_id, ''), r.bulk_row_number,
  COALESCE(b.file_name, ''), COALESCE(b.bulk_status, ''), COALESCE(b.total_rows, 0), COALESCE(b.invalid_rows, 0), b.validation_errors,
  CASE WHEN p.id IS NOT NULL THEN r.catalog_project_id ELSE NULL END,
  CASE WHEN a.id IS NOT NULL AND p.id IS NOT NULL THEN r.catalog_application_id ELSE NULL END,
  COALESCE(j.repository_url, ''), COALESCE(j.branch, ''),
  COALESCE(j.job_status, ''), COALESCE(j.job_payload, '{}'), COALESCE(j.priority, 0), COALESCE(j.attempts, 0),
  COALESCE(j.max_attempts, 3), j.next_attempt_at, j.started_at, j.completed_at,
  COALESCE(j.error_code, ''), COALESCE(j.error_message, ''), COALESCE(ev.events, '[]'::jsonb)
FROM tbl_scan_runs r
LEFT JOIN tbl_bulk_scans b ON b.id = NULLIF(r.bulk_scan_id, '')
LEFT JOIN projects p ON p.id = r.catalog_project_id AND p.organization_id = r.organization_id
LEFT JOIN applications a
  ON a.id = r.catalog_application_id AND a.project_id = r.catalog_project_id AND a.organization_id = r.organization_id
LEFT JOIN LATERAL (
  SELECT
    job.job_status, job.job_payload, job.priority, job.attempts, job.max_attempts, job.next_attempt_at,
    job.started_at, job.completed_at, job.error_code, job.error_message,
    COALESCE(sbom_jsonb(job.job_payload)->>'repository_url', '') AS repository_url,
    COALESCE(sbom_jsonb(job.job_payload)->>'branch', '') AS branch
  FROM tbl_scan_jobs job
  WHERE job.scan_run_id = r.id
  ORDER BY job.created_at DESC
  LIMIT 1
) j ON TRUE
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'stage', e.scan_stage,
      'message', e.event_message,
      'data', CASE WHEN e.event_data IS NULL OR e.event_data = 'null' THEN NULL ELSE sbom_jsonb(e.event_data) END,
      'created_at', to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
    ORDER BY e.created_at
  ) AS events
  FROM tbl_scan_events e
  WHERE e.scan_run_id = r.id
) ev ON TRUE
ON CONFLICT (id) DO NOTHING;

INSERT INTO scans (
  id, organization_id, project_id, application_id, application_name, application_version,
  version_strategy, bom_type, source_type, scan_status, scan_stage, error_code, error_message,
  idempotency_key, created_at, bulk_scan_id, bulk_row_number, bulk_file_name, bulk_status,
  bulk_total_rows, bulk_invalid_rows, bulk_errors, repository_url
)
SELECT
  i.id, b.organization_id, i.project_name, i.application_name, i.application_name, i.application_version,
  'VERSION_MANUAL', 'SBOM', 'GITHUB', i.item_status, i.item_status,
  COALESCE(i.error_code, ''), COALESCE(i.error_message, ''),
  'bulk-item:' || i.id, COALESCE(i.started_at, b.created_at), b.id, i.source_row_number,
  b.file_name, b.bulk_status, b.total_rows, b.invalid_rows, b.validation_errors, i.repository_url
FROM tbl_bulk_scan_items i
JOIN tbl_bulk_scans b ON b.id = i.bulk_scan_id
WHERE i.scan_run_id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO sboms (
  id, organization_id, project_id, application_id, scan_id, catalog_project_id, catalog_application_id,
  bom_type, application_version, version_strategy, repository_url, repository_branch, commit_sha,
  commit_author, commit_email, commit_message, scanner_name, scanner_version, bom_format_version,
  generated_at, raw_metadata, file_name, file_format, file_size_bytes, signature_status, facts_normalized
)
SELECT
  s.id, s.organization_id, s.project_id, s.application_id, s.scan_run_id,
  CASE WHEN p.id IS NOT NULL THEN s.catalog_project_id ELSE NULL END,
  CASE WHEN a.id IS NOT NULL AND p.id IS NOT NULL THEN s.catalog_application_id ELSE NULL END,
  s.bom_type, s.application_version, s.version_strategy, s.repository_url, s.repository_branch, s.commit_sha,
  s.commit_author, s.commit_email, s.commit_message, s.scanner_name, s.scanner_version, s.bom_format_version,
  s.generated_at, s.raw_metadata,
  COALESCE(d.file_name, ''), COALESCE(d.file_format, ''), COALESCE(d.file_size_bytes, 0), COALESCE(d.signature_status, ''),
  TRUE
FROM tbl_bom_snapshots s
JOIN scans sc ON sc.id = s.scan_run_id
LEFT JOIN projects p ON p.id = s.catalog_project_id AND p.organization_id = s.organization_id
LEFT JOIN applications a
  ON a.id = s.catalog_application_id AND a.project_id = s.catalog_project_id AND a.organization_id = s.organization_id
LEFT JOIN tbl_sbom_documents_and_artifacts d ON d.source_snapshot_id = s.id
ON CONFLICT (id) DO NOTHING;

UPDATE scans AS sc
SET sbom_id = s.id
FROM sboms AS s
WHERE s.scan_id = sc.id
  AND sc.sbom_id IS NULL;

INSERT INTO sbom_components (
  id, sbom_id, name, version, ecosystem, package_manager, package_url, cpe, content_hash,
  license_name, supplier_name, dependency_scope, is_direct_dependency, source_manifest,
  raw_component, created_at, dependency_depth
)
SELECT
  c.id, c.bom_snapshot_id, c.component_name, c.component_version, c.ecosystem, c.package_manager,
  c.package_url, c.cpe, c.content_hash, c.license_name, c.supplier_name, c.dependency_scope,
  c.is_direct_dependency, c.source_manifest, c.raw_component, c.created_at, c.dependency_depth
FROM tbl_bom_components c
JOIN sboms s ON s.id = c.bom_snapshot_id
ON CONFLICT (id) DO NOTHING;

UPDATE sbom_components AS c
SET depends_on = edges.ids
FROM (
  SELECT d.from_component_id, array_agg(d.to_component_id ORDER BY d.to_component_id) AS ids
  FROM tbl_bom_dependencies d
  GROUP BY d.from_component_id
) AS edges
WHERE c.id = edges.from_component_id
  AND c.depends_on = '{}';

UPDATE sbom_components AS c
SET
  ntia_supplier = checks.ntia_supplier,
  ntia_name = checks.ntia_name,
  ntia_version = checks.ntia_version,
  ntia_identifier = checks.ntia_identifier,
  ntia_relationship = checks.ntia_relationship,
  ntia_author = checks.ntia_author,
  ntia_timestamp = checks.ntia_timestamp
FROM (
  SELECT
    bom_component_id,
    bool_or(passed) FILTER (WHERE check_code = 'ntia_supplier') AS ntia_supplier,
    bool_or(passed) FILTER (WHERE check_code = 'ntia_name') AS ntia_name,
    bool_or(passed) FILTER (WHERE check_code = 'ntia_version') AS ntia_version,
    bool_or(passed) FILTER (WHERE check_code = 'ntia_identifier') AS ntia_identifier,
    bool_or(passed) FILTER (WHERE check_code = 'ntia_relationship') AS ntia_relationship,
    bool_or(passed) FILTER (WHERE check_code = 'ntia_author') AS ntia_author,
    bool_or(passed) FILTER (WHERE check_code = 'ntia_timestamp') AS ntia_timestamp
  FROM tbl_component_compliance_checks
  GROUP BY bom_component_id
) AS checks
WHERE c.id = checks.bom_component_id;

INSERT INTO vulnerabilities (
  id, vulnerability_key, source, severity, cvss_score, cvss_vector, description, created_at, updated_at
)
SELECT id, vulnerability_key, source, severity, cvss_score, cvss_vector, description, created_at, updated_at
FROM tbl_vulnerabilities
ON CONFLICT (vulnerability_key) DO NOTHING;

UPDATE vulnerabilities AS v
SET reference_urls = refs.urls
FROM (
  SELECT vulnerability_id, array_agg(reference_url ORDER BY reference_url) AS urls
  FROM tbl_vulnerability_references
  GROUP BY vulnerability_id
) AS refs
WHERE v.id = refs.vulnerability_id
  AND v.reference_urls = '{}';

INSERT INTO findings (
  id, sbom_id, sbom_component_id, vulnerability_id, source, severity, cvss_score,
  cvss_vector, description, fixed_version, created_at
)
SELECT
  f.id, f.bom_snapshot_id, f.bom_component_id, f.vulnerability_id, f.source, f.severity, f.cvss_score,
  f.cvss_vector, f.description, f.fixed_version, f.created_at
FROM tbl_findings f
JOIN sbom_components c ON c.id = f.bom_component_id AND c.sbom_id = f.bom_snapshot_id
JOIN vulnerabilities v ON v.id = f.vulnerability_id
ON CONFLICT (sbom_component_id, vulnerability_id) DO NOTHING;

DROP TABLE IF EXISTS tbl_component_compliance_checks CASCADE;
DROP TABLE IF EXISTS tbl_component_hashes CASCADE;
DROP TABLE IF EXISTS tbl_findings CASCADE;
DROP TABLE IF EXISTS tbl_vulnerability_references CASCADE;
DROP TABLE IF EXISTS tbl_vulnerabilities CASCADE;
DROP TABLE IF EXISTS tbl_commits CASCADE;
DROP TABLE IF EXISTS tbl_repository_branches CASCADE;
DROP TABLE IF EXISTS tbl_repositories CASCADE;
DROP TABLE IF EXISTS tbl_package_versions CASCADE;
DROP TABLE IF EXISTS tbl_packages CASCADE;
DROP TABLE IF EXISTS tbl_sbom_document_components CASCADE;
DROP TABLE IF EXISTS tbl_sbom_documents_and_artifacts CASCADE;
DROP TABLE IF EXISTS tbl_software_components_and_packages CASCADE;
DROP TABLE IF EXISTS tbl_bom_dependencies CASCADE;
DROP TABLE IF EXISTS tbl_bom_components CASCADE;
DROP TABLE IF EXISTS tbl_audit_logs CASCADE;
DROP TABLE IF EXISTS tbl_webhook_events CASCADE;
DROP TABLE IF EXISTS tbl_scan_events CASCADE;
DROP TABLE IF EXISTS tbl_scan_jobs CASCADE;
DROP TABLE IF EXISTS tbl_bulk_scan_items CASCADE;
DROP TABLE IF EXISTS tbl_git_credentials CASCADE;
DROP TABLE IF EXISTS tbl_credential_secrets CASCADE;
DROP TABLE IF EXISTS tbl_bom_snapshots CASCADE;
DROP TABLE IF EXISTS tbl_scan_runs CASCADE;
DROP TABLE IF EXISTS tbl_bulk_scans CASCADE;
DROP TABLE IF EXISTS tbl_security_scans CASCADE;
DROP TABLE IF EXISTS tbl_project_applications_and_services CASCADE;
DROP TABLE IF EXISTS tbl_projects_and_microservices CASCADE;
DROP TABLE IF EXISTS tbl_software_inventory CASCADE;
DROP TABLE IF EXISTS tbl_organizations CASCADE;

COMMENT ON TABLE organizations IS 'Tenant. Projects, scans, and credentials belong to one organization.';
COMMENT ON TABLE projects IS 'Project catalog for one organization.';
COMMENT ON TABLE applications IS 'Application or service that belongs to one project.';
COMMENT ON TABLE inventory_components IS 'Package tracked on an application in the software inventory.';
COMMENT ON TABLE credentials IS 'Git credential and its encrypted secret.';
COMMENT ON TABLE scans IS 'One scan execution, its queue fields, bulk row, and progress events.';
COMMENT ON TABLE sboms IS 'SBOM produced by one scan, including repository and commit text.';
COMMENT ON TABLE sbom_components IS 'Package found in one SBOM, including NTIA checks and dependency ids.';
COMMENT ON TABLE vulnerabilities IS 'Canonical CVE or advisory. reference_urls lists its links.';
COMMENT ON TABLE findings IS 'One vulnerability match for one package in one SBOM.';
