-- Relational facts that used to live in JSON blobs or copied name columns.
--
-- Organizations
--   ├── tbl_projects_and_microservices
--   │     └── tbl_project_applications_and_services
--   ├── tbl_repositories
--   │     ├── tbl_repository_branches
--   │     └── tbl_commits
--   └── tbl_scan_runs
--         └── tbl_bom_snapshots
--               └── tbl_bom_components
--                     ├── tbl_findings → tbl_vulnerabilities
--                     ├── tbl_component_hashes
--                     └── tbl_component_compliance_checks
--
-- tbl_packages → tbl_package_versions is a shared catalog. Snapshot and
-- inventory rows point at a version instead of being the only copy of the
-- package identity.

CREATE OR REPLACE FUNCTION sbom_jsonb(raw text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN raw::jsonb;
EXCEPTION WHEN others THEN
  RETURN '{}'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION sbom_score(raw text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  n numeric;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN 0;
  END IF;
  n := raw::numeric;
  IF n < 0 THEN
    RETURN 0;
  END IF;
  IF n > 10 THEN
    RETURN 10;
  END IF;
  RETURN round(n, 1);
EXCEPTION WHEN others THEN
  RETURN 0;
END;
$$;

CREATE TABLE IF NOT EXISTS tbl_packages (
  id TEXT PRIMARY KEY,
  ecosystem TEXT NOT NULL,
  package_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ecosystem, package_name),
  CHECK (length(btrim(ecosystem)) > 0),
  CHECK (length(btrim(package_name)) > 0)
);

CREATE TABLE IF NOT EXISTS tbl_package_versions (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  version TEXT NOT NULL,
  package_url TEXT NOT NULL DEFAULT '',
  license_name TEXT NOT NULL DEFAULT '',
  supplier_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (package_id, version),
  FOREIGN KEY (package_id) REFERENCES tbl_packages (id) ON DELETE RESTRICT,
  CHECK (length(btrim(version)) > 0)
);

CREATE TABLE IF NOT EXISTS tbl_vulnerabilities (
  id TEXT PRIMARY KEY,
  vulnerability_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'UNKNOWN',
  cvss_score NUMERIC(4,1) NOT NULL DEFAULT 0,
  cvss_vector TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (vulnerability_key),
  CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')),
  CHECK (cvss_score >= 0 AND cvss_score <= 10)
);

CREATE TABLE IF NOT EXISTS tbl_vulnerability_references (
  id TEXT PRIMARY KEY,
  vulnerability_id TEXT NOT NULL,
  reference_url TEXT NOT NULL,
  UNIQUE (vulnerability_id, reference_url),
  FOREIGN KEY (vulnerability_id) REFERENCES tbl_vulnerabilities (id) ON DELETE CASCADE,
  CHECK (length(btrim(reference_url)) > 0)
);

CREATE TABLE IF NOT EXISTS tbl_repositories (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  host_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, repository_url),
  FOREIGN KEY (organization_id) REFERENCES tbl_organizations (id) ON DELETE CASCADE,
  CHECK (length(btrim(repository_url)) > 0)
);

CREATE TABLE IF NOT EXISTS tbl_repository_branches (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (repository_id, branch_name),
  FOREIGN KEY (repository_id) REFERENCES tbl_repositories (id) ON DELETE CASCADE,
  CHECK (length(btrim(branch_name)) > 0)
);

CREATE TABLE IF NOT EXISTS tbl_commits (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  author_email TEXT NOT NULL DEFAULT '',
  commit_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (repository_id, commit_sha),
  FOREIGN KEY (repository_id) REFERENCES tbl_repositories (id) ON DELETE CASCADE,
  CHECK (length(btrim(commit_sha)) > 0)
);

CREATE TABLE IF NOT EXISTS tbl_findings (
  id TEXT PRIMARY KEY,
  bom_snapshot_id TEXT NOT NULL,
  bom_component_id TEXT NOT NULL,
  vulnerability_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'UNKNOWN',
  cvss_score NUMERIC(4,1) NOT NULL DEFAULT 0,
  cvss_vector TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  fixed_version TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (bom_component_id, vulnerability_id),
  FOREIGN KEY (bom_snapshot_id) REFERENCES tbl_bom_snapshots (id) ON DELETE CASCADE,
  FOREIGN KEY (bom_component_id, bom_snapshot_id)
    REFERENCES tbl_bom_components (id, bom_snapshot_id) ON DELETE CASCADE,
  FOREIGN KEY (vulnerability_id) REFERENCES tbl_vulnerabilities (id) ON DELETE RESTRICT,
  CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')),
  CHECK (cvss_score >= 0 AND cvss_score <= 10)
);

CREATE TABLE IF NOT EXISTS tbl_component_hashes (
  id TEXT PRIMARY KEY,
  bom_component_id TEXT NOT NULL,
  bom_snapshot_id TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  hash_value TEXT NOT NULL,
  UNIQUE (bom_component_id, algorithm),
  FOREIGN KEY (bom_component_id, bom_snapshot_id)
    REFERENCES tbl_bom_components (id, bom_snapshot_id) ON DELETE CASCADE,
  CHECK (length(btrim(algorithm)) > 0),
  CHECK (length(btrim(hash_value)) > 0)
);

CREATE TABLE IF NOT EXISTS tbl_component_compliance_checks (
  bom_component_id TEXT NOT NULL,
  bom_snapshot_id TEXT NOT NULL,
  check_code TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  PRIMARY KEY (bom_component_id, check_code),
  FOREIGN KEY (bom_component_id, bom_snapshot_id)
    REFERENCES tbl_bom_components (id, bom_snapshot_id) ON DELETE CASCADE,
  CHECK (check_code IN (
    'ntia_supplier', 'ntia_name', 'ntia_version', 'ntia_identifier',
    'ntia_relationship', 'ntia_author', 'ntia_timestamp'
  ))
);

ALTER TABLE tbl_scan_runs ADD COLUMN IF NOT EXISTS catalog_project_id TEXT;
ALTER TABLE tbl_scan_runs ADD COLUMN IF NOT EXISTS catalog_application_id TEXT;

ALTER TABLE tbl_bom_snapshots ADD COLUMN IF NOT EXISTS catalog_project_id TEXT;
ALTER TABLE tbl_bom_snapshots ADD COLUMN IF NOT EXISTS catalog_application_id TEXT;
ALTER TABLE tbl_bom_snapshots ADD COLUMN IF NOT EXISTS repository_id TEXT;
ALTER TABLE tbl_bom_snapshots ADD COLUMN IF NOT EXISTS repository_branch_id TEXT;
ALTER TABLE tbl_bom_snapshots ADD COLUMN IF NOT EXISTS commit_id TEXT;
ALTER TABLE tbl_bom_snapshots ADD COLUMN IF NOT EXISTS facts_normalized BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tbl_bom_components ADD COLUMN IF NOT EXISTS package_version_id TEXT;
ALTER TABLE tbl_bom_components ADD COLUMN IF NOT EXISTS dependency_depth INTEGER;

ALTER TABLE tbl_software_components_and_packages ADD COLUMN IF NOT EXISTS package_version_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scan_runs_catalog_project') THEN
    ALTER TABLE tbl_scan_runs
      ADD CONSTRAINT fk_scan_runs_catalog_project
      FOREIGN KEY (catalog_project_id, organization_id)
      REFERENCES tbl_projects_and_microservices (id, organization_id)
      ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scan_runs_catalog_application') THEN
    ALTER TABLE tbl_scan_runs
      ADD CONSTRAINT fk_scan_runs_catalog_application
      FOREIGN KEY (catalog_application_id, catalog_project_id, organization_id)
      REFERENCES tbl_project_applications_and_services (id, project_id, organization_id)
      ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bom_snapshots_catalog_project') THEN
    ALTER TABLE tbl_bom_snapshots
      ADD CONSTRAINT fk_bom_snapshots_catalog_project
      FOREIGN KEY (catalog_project_id, organization_id)
      REFERENCES tbl_projects_and_microservices (id, organization_id)
      ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bom_snapshots_catalog_application') THEN
    ALTER TABLE tbl_bom_snapshots
      ADD CONSTRAINT fk_bom_snapshots_catalog_application
      FOREIGN KEY (catalog_application_id, catalog_project_id, organization_id)
      REFERENCES tbl_project_applications_and_services (id, project_id, organization_id)
      ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bom_snapshots_repository') THEN
    ALTER TABLE tbl_bom_snapshots
      ADD CONSTRAINT fk_bom_snapshots_repository
      FOREIGN KEY (repository_id) REFERENCES tbl_repositories (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bom_snapshots_branch') THEN
    ALTER TABLE tbl_bom_snapshots
      ADD CONSTRAINT fk_bom_snapshots_branch
      FOREIGN KEY (repository_branch_id) REFERENCES tbl_repository_branches (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bom_snapshots_commit') THEN
    ALTER TABLE tbl_bom_snapshots
      ADD CONSTRAINT fk_bom_snapshots_commit
      FOREIGN KEY (commit_id) REFERENCES tbl_commits (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bom_components_package_version') THEN
    ALTER TABLE tbl_bom_components
      ADD CONSTRAINT fk_bom_components_package_version
      FOREIGN KEY (package_version_id) REFERENCES tbl_package_versions (id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventory_components_package_version') THEN
    ALTER TABLE tbl_software_components_and_packages
      ADD CONSTRAINT fk_inventory_components_package_version
      FOREIGN KEY (package_version_id) REFERENCES tbl_package_versions (id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_bom_components_depth') THEN
    ALTER TABLE tbl_bom_components
      ADD CONSTRAINT ck_bom_components_depth CHECK (dependency_depth IS NULL OR dependency_depth >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_package_versions_package ON tbl_package_versions (package_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_references_vulnerability ON tbl_vulnerability_references (vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_repositories_organization ON tbl_repositories (organization_id);
CREATE INDEX IF NOT EXISTS idx_repository_branches_repository ON tbl_repository_branches (repository_id);
CREATE INDEX IF NOT EXISTS idx_commits_repository ON tbl_commits (repository_id, commit_sha);
CREATE INDEX IF NOT EXISTS idx_findings_snapshot ON tbl_findings (bom_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_findings_vulnerability ON tbl_findings (vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON tbl_findings (bom_snapshot_id, severity);
CREATE INDEX IF NOT EXISTS idx_component_hashes_snapshot ON tbl_component_hashes (bom_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_snapshot ON tbl_component_compliance_checks (bom_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_scan_runs_catalog_project ON tbl_scan_runs (catalog_project_id);
CREATE INDEX IF NOT EXISTS idx_scan_runs_catalog_application ON tbl_scan_runs (catalog_application_id);
CREATE INDEX IF NOT EXISTS idx_bom_snapshots_catalog_project ON tbl_bom_snapshots (catalog_project_id);
CREATE INDEX IF NOT EXISTS idx_bom_components_package_version ON tbl_bom_components (package_version_id);
CREATE INDEX IF NOT EXISTS idx_inventory_components_package_version ON tbl_software_components_and_packages (package_version_id);

UPDATE tbl_scan_runs AS r
SET catalog_project_id = p.id
FROM tbl_projects_and_microservices AS p
WHERE r.catalog_project_id IS NULL
  AND p.organization_id = r.organization_id
  AND p.project_name = r.project_id
  AND btrim(r.project_id) <> '';

UPDATE tbl_scan_runs AS r
SET catalog_application_id = a.id
FROM tbl_project_applications_and_services AS a
WHERE r.catalog_application_id IS NULL
  AND r.catalog_project_id IS NOT NULL
  AND a.organization_id = r.organization_id
  AND a.project_id = r.catalog_project_id
  AND a.service_name = CASE
    WHEN btrim(r.application_id) <> '' THEN r.application_id
    ELSE r.application_name
  END;

UPDATE tbl_bom_snapshots AS s
SET catalog_project_id = p.id
FROM tbl_projects_and_microservices AS p
WHERE s.catalog_project_id IS NULL
  AND p.organization_id = s.organization_id
  AND p.project_name = s.project_id
  AND btrim(s.project_id) <> '';

UPDATE tbl_bom_snapshots AS s
SET catalog_application_id = a.id
FROM tbl_project_applications_and_services AS a
WHERE s.catalog_application_id IS NULL
  AND s.catalog_project_id IS NOT NULL
  AND a.organization_id = s.organization_id
  AND a.project_id = s.catalog_project_id
  AND a.service_name = s.application_id
  AND btrim(s.application_id) <> '';

INSERT INTO tbl_repositories (id, organization_id, repository_url, host_name)
SELECT
  md5(s.organization_id || chr(31) || s.repository_url),
  s.organization_id,
  s.repository_url,
  COALESCE(substring(s.repository_url from 'https?://([^/]+)'), '')
FROM tbl_bom_snapshots s
WHERE btrim(s.repository_url) <> ''
  AND btrim(s.organization_id) <> ''
ON CONFLICT (organization_id, repository_url) DO NOTHING;

INSERT INTO tbl_repository_branches (id, repository_id, branch_name)
SELECT
  md5(r.id || chr(31) || s.repository_branch),
  r.id,
  s.repository_branch
FROM tbl_bom_snapshots s
JOIN tbl_repositories r
  ON r.organization_id = s.organization_id
 AND r.repository_url = s.repository_url
WHERE btrim(s.repository_branch) <> ''
ON CONFLICT (repository_id, branch_name) DO NOTHING;

INSERT INTO tbl_commits (id, repository_id, commit_sha, author_name, author_email, commit_message)
SELECT DISTINCT ON (r.id, s.commit_sha)
  md5(r.id || chr(31) || s.commit_sha),
  r.id,
  s.commit_sha,
  s.commit_author,
  s.commit_email,
  s.commit_message
FROM tbl_bom_snapshots s
JOIN tbl_repositories r
  ON r.organization_id = s.organization_id
 AND r.repository_url = s.repository_url
WHERE btrim(s.commit_sha) <> ''
ORDER BY r.id, s.commit_sha, s.generated_at DESC
ON CONFLICT (repository_id, commit_sha) DO NOTHING;

UPDATE tbl_bom_snapshots AS s
SET repository_id = r.id
FROM tbl_repositories AS r
WHERE s.repository_id IS NULL
  AND r.organization_id = s.organization_id
  AND r.repository_url = s.repository_url
  AND btrim(s.repository_url) <> '';

UPDATE tbl_bom_snapshots AS s
SET repository_branch_id = b.id
FROM tbl_repository_branches AS b
WHERE s.repository_branch_id IS NULL
  AND s.repository_id IS NOT NULL
  AND b.repository_id = s.repository_id
  AND b.branch_name = s.repository_branch
  AND btrim(s.repository_branch) <> '';

UPDATE tbl_bom_snapshots AS s
SET commit_id = c.id
FROM tbl_commits AS c
WHERE s.commit_id IS NULL
  AND s.repository_id IS NOT NULL
  AND c.repository_id = s.repository_id
  AND c.commit_sha = s.commit_sha
  AND btrim(s.commit_sha) <> '';

INSERT INTO tbl_packages (id, ecosystem, package_name)
SELECT
  md5(lower(btrim(ecosystem)) || chr(31) || lower(btrim(component_name))),
  lower(btrim(ecosystem)),
  lower(btrim(component_name))
FROM (
  SELECT ecosystem, component_name FROM tbl_bom_components
  UNION
  SELECT ecosystem, package_name FROM tbl_software_components_and_packages
) AS names
WHERE btrim(ecosystem) <> ''
  AND btrim(component_name) <> ''
ON CONFLICT (ecosystem, package_name) DO NOTHING;

INSERT INTO tbl_package_versions (id, package_id, version, package_url, license_name, supplier_name)
SELECT DISTINCT ON (p.id, c.component_version)
  md5(p.id || chr(31) || c.component_version),
  p.id,
  c.component_version,
  c.package_url,
  c.license_name,
  c.supplier_name
FROM tbl_bom_components c
JOIN tbl_packages p
  ON p.ecosystem = lower(btrim(c.ecosystem))
 AND p.package_name = lower(btrim(c.component_name))
WHERE btrim(c.component_version) <> ''
ORDER BY p.id, c.component_version, c.created_at DESC
ON CONFLICT (package_id, version) DO NOTHING;

INSERT INTO tbl_package_versions (id, package_id, version, package_url, license_name, supplier_name)
SELECT DISTINCT ON (p.id, c.version)
  md5(p.id || chr(31) || c.version),
  p.id,
  c.version,
  c.package_url,
  c.license_name,
  c.supplier_name
FROM tbl_software_components_and_packages c
JOIN tbl_packages p
  ON p.ecosystem = lower(btrim(c.ecosystem))
 AND p.package_name = lower(btrim(c.package_name))
WHERE btrim(c.version) <> ''
ORDER BY p.id, c.version, c.created_at DESC
ON CONFLICT (package_id, version) DO NOTHING;

UPDATE tbl_bom_components AS c
SET package_version_id = v.id
FROM tbl_packages AS p
JOIN tbl_package_versions AS v ON v.package_id = p.id
WHERE c.package_version_id IS NULL
  AND p.ecosystem = lower(btrim(c.ecosystem))
  AND p.package_name = lower(btrim(c.component_name))
  AND v.version = c.component_version;

UPDATE tbl_software_components_and_packages AS c
SET package_version_id = v.id
FROM tbl_packages AS p
JOIN tbl_package_versions AS v ON v.package_id = p.id
WHERE c.package_version_id IS NULL
  AND p.ecosystem = lower(btrim(c.ecosystem))
  AND p.package_name = lower(btrim(c.package_name))
  AND v.version = c.version;

UPDATE tbl_bom_components AS c
SET dependency_depth = (sbom_jsonb(c.raw_component)->>'depth')::integer
WHERE c.dependency_depth IS NULL
  AND sbom_jsonb(c.raw_component) ? 'depth'
  AND (sbom_jsonb(c.raw_component)->>'depth') ~ '^[0-9]+$';

INSERT INTO tbl_vulnerabilities (
  id, vulnerability_key, source, severity, cvss_score, cvss_vector, description
)
SELECT DISTINCT ON (upper(btrim(match->>'vulnerability_id')))
  md5('vuln:' || upper(btrim(match->>'vulnerability_id'))),
  upper(btrim(match->>'vulnerability_id')),
  COALESCE(match->>'source', ''),
  CASE
    WHEN upper(COALESCE(match->>'severity', '')) IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
      THEN upper(match->>'severity')
    ELSE 'UNKNOWN'
  END,
  sbom_score(match->>'cvss_score'),
  COALESCE(match->>'cvss_vector', ''),
  COALESCE(match->>'description', '')
FROM tbl_bom_snapshots s
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(sbom_jsonb(s.raw_metadata)->'vulnerability_matches') = 'array'
      THEN sbom_jsonb(s.raw_metadata)->'vulnerability_matches'
    ELSE '[]'::jsonb
  END
) AS match
WHERE btrim(COALESCE(match->>'vulnerability_id', '')) <> ''
ORDER BY upper(btrim(match->>'vulnerability_id')), s.generated_at DESC
ON CONFLICT (vulnerability_key) DO NOTHING;

INSERT INTO tbl_vulnerability_references (id, vulnerability_id, reference_url)
SELECT DISTINCT
  md5(v.id || chr(31) || ref.url),
  v.id,
  ref.url
FROM tbl_bom_snapshots s
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(sbom_jsonb(s.raw_metadata)->'vulnerability_matches') = 'array'
      THEN sbom_jsonb(s.raw_metadata)->'vulnerability_matches'
    ELSE '[]'::jsonb
  END
) AS match
JOIN tbl_vulnerabilities v
  ON v.vulnerability_key = upper(btrim(match->>'vulnerability_id'))
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(match->'references') = 'array' THEN match->'references'
    ELSE '[]'::jsonb
  END
) AS ref(url)
WHERE btrim(ref.url) <> ''
ON CONFLICT (vulnerability_id, reference_url) DO NOTHING;

INSERT INTO tbl_findings (
  id, bom_snapshot_id, bom_component_id, vulnerability_id, source, severity,
  cvss_score, cvss_vector, description, fixed_version
)
SELECT DISTINCT ON (c.id, v.id)
  md5(c.id || chr(31) || v.id),
  s.id,
  c.id,
  v.id,
  COALESCE(match->>'source', ''),
  CASE
    WHEN upper(COALESCE(match->>'severity', '')) IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
      THEN upper(match->>'severity')
    ELSE 'UNKNOWN'
  END,
  sbom_score(match->>'cvss_score'),
  COALESCE(match->>'cvss_vector', ''),
  COALESCE(match->>'description', ''),
  COALESCE(match->>'fixed_version', '')
FROM tbl_bom_snapshots s
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(sbom_jsonb(s.raw_metadata)->'vulnerability_matches') = 'array'
      THEN sbom_jsonb(s.raw_metadata)->'vulnerability_matches'
    ELSE '[]'::jsonb
  END
) AS match
JOIN tbl_bom_components c
  ON c.bom_snapshot_id = s.id
 AND c.id = match->>'component_id'
JOIN tbl_vulnerabilities v
  ON v.vulnerability_key = upper(btrim(match->>'vulnerability_id'))
ORDER BY c.id, v.id, s.generated_at DESC
ON CONFLICT (bom_component_id, vulnerability_id) DO NOTHING;

INSERT INTO tbl_component_hashes (id, bom_component_id, bom_snapshot_id, algorithm, hash_value)
SELECT
  md5(c.id || chr(31) || hash.algorithm),
  c.id,
  c.bom_snapshot_id,
  hash.algorithm,
  hash.hash_value
FROM tbl_bom_components c
CROSS JOIN LATERAL jsonb_each_text(
  CASE
    WHEN jsonb_typeof(sbom_jsonb(c.raw_component)->'hashes') = 'object'
      THEN sbom_jsonb(c.raw_component)->'hashes'
    ELSE '{}'::jsonb
  END
) AS hash(algorithm, hash_value)
WHERE btrim(hash.algorithm) <> ''
  AND btrim(hash.hash_value) <> ''
ON CONFLICT (bom_component_id, algorithm) DO NOTHING;

INSERT INTO tbl_component_compliance_checks (bom_component_id, bom_snapshot_id, check_code, passed)
SELECT
  c.id,
  c.bom_snapshot_id,
  check_row.check_code,
  lower(check_row.passed) IN ('true', 't', '1')
FROM tbl_bom_components c
CROSS JOIN LATERAL jsonb_each_text(
  CASE
    WHEN jsonb_typeof(sbom_jsonb(c.raw_component)->'compliance_status') = 'object'
      THEN sbom_jsonb(c.raw_component)->'compliance_status'
    ELSE '{}'::jsonb
  END
) AS check_row(check_code, passed)
WHERE check_row.check_code IN (
  'ntia_supplier', 'ntia_name', 'ntia_version', 'ntia_identifier',
  'ntia_relationship', 'ntia_author', 'ntia_timestamp'
)
ON CONFLICT (bom_component_id, check_code) DO NOTHING;

UPDATE tbl_bom_snapshots
SET facts_normalized = TRUE
WHERE facts_normalized = FALSE;

COMMENT ON TABLE tbl_packages IS 'Canonical package identity: ecosystem plus name. Shared by scans and inventory.';
COMMENT ON TABLE tbl_package_versions IS 'One published version of a package, including purl, license, and supplier.';
COMMENT ON TABLE tbl_vulnerabilities IS 'Canonical vulnerability record keyed by CVE or advisory id.';
COMMENT ON TABLE tbl_vulnerability_references IS 'Reference URLs that belong to one vulnerability.';
COMMENT ON TABLE tbl_repositories IS 'Source repository URL owned by one organization.';
COMMENT ON TABLE tbl_repository_branches IS 'Named branch of a repository.';
COMMENT ON TABLE tbl_commits IS 'Commit observed on a repository. Rows are not rewritten after insert.';
COMMENT ON TABLE tbl_findings IS 'Vulnerability match for one package inside one SBOM snapshot. Scores are the values seen at scan time.';
COMMENT ON TABLE tbl_component_hashes IS 'Integrity hash for one package occurrence in a snapshot.';
COMMENT ON TABLE tbl_component_compliance_checks IS 'One NTIA minimum-element check for one snapshot package.';
