-- Software inventory is one record per organization.
-- The three inventory screens are child tables of that record:
--   tbl_software_components_and_packages
--   tbl_projects_and_microservices
--     └── tbl_project_applications_and_services
--   tbl_sbom_documents_and_artifacts
--     └── tbl_sbom_document_components
-- Names live in one table. Other tables point at that row instead of copying the name.

CREATE TABLE IF NOT EXISTS tbl_organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tbl_software_inventory (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Software inventory',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id),
  UNIQUE (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES tbl_organizations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tbl_projects_and_microservices (
  id TEXT PRIMARY KEY,
  software_inventory_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, project_name),
  UNIQUE (id, organization_id),
  UNIQUE (id, software_inventory_id, organization_id),
  FOREIGN KEY (software_inventory_id, organization_id)
    REFERENCES tbl_software_inventory (id, organization_id) ON DELETE CASCADE,
  CHECK (length(btrim(project_name)) > 0)
);

CREATE TABLE IF NOT EXISTS tbl_project_applications_and_services (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, project_id, service_name),
  UNIQUE (id, organization_id),
  UNIQUE (id, project_id, organization_id),
  FOREIGN KEY (project_id, organization_id)
    REFERENCES tbl_projects_and_microservices (id, organization_id) ON DELETE CASCADE,
  CHECK (length(btrim(service_name)) > 0)
);

CREATE TABLE IF NOT EXISTS tbl_software_components_and_packages (
  id TEXT PRIMARY KEY,
  software_inventory_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  component_name TEXT NOT NULL,
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
  UNIQUE (id, organization_id),
  FOREIGN KEY (software_inventory_id, organization_id)
    REFERENCES tbl_software_inventory (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, software_inventory_id, organization_id)
    REFERENCES tbl_projects_and_microservices (id, software_inventory_id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (service_id, project_id, organization_id)
    REFERENCES tbl_project_applications_and_services (id, project_id, organization_id) ON DELETE CASCADE,
  CHECK (length(btrim(component_name)) > 0),
  CHECK (length(btrim(version)) > 0),
  CHECK (vulnerability_count >= 0),
  CHECK (component_type IN (
    'Library', 'Application', 'Framework', 'Container', 'Service',
    'Operating System', 'Device / Firmware', 'File'
  )),
  CHECK (risk_level IN ('Safe', 'Low', 'Medium', 'High', 'Critical'))
);

CREATE TABLE IF NOT EXISTS tbl_sbom_documents_and_artifacts (
  id TEXT PRIMARY KEY,
  software_inventory_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_format TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  signature_status TEXT NOT NULL DEFAULT 'Unsigned',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_snapshot_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, organization_id),
  FOREIGN KEY (software_inventory_id, organization_id)
    REFERENCES tbl_software_inventory (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, software_inventory_id, organization_id)
    REFERENCES tbl_projects_and_microservices (id, software_inventory_id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (source_snapshot_id) REFERENCES tbl_bom_snapshots (id) ON DELETE SET NULL,
  CHECK (length(btrim(file_name)) > 0),
  CHECK (file_size_bytes >= 0),
  CHECK (file_format IN ('SPDX-2.3', 'CycloneDX-1.5')),
  CHECK (signature_status IN ('Pass', 'Fail', 'Unsigned'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sbom_documents_one_snapshot
  ON tbl_sbom_documents_and_artifacts (source_snapshot_id)
  WHERE source_snapshot_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tbl_sbom_document_components (
  sbom_document_id TEXT NOT NULL,
  software_component_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  PRIMARY KEY (sbom_document_id, software_component_id),
  FOREIGN KEY (sbom_document_id, organization_id)
    REFERENCES tbl_sbom_documents_and_artifacts (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (software_component_id, organization_id)
    REFERENCES tbl_software_components_and_packages (id, organization_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_inventory
  ON tbl_projects_and_microservices (software_inventory_id);

CREATE INDEX IF NOT EXISTS idx_services_project
  ON tbl_project_applications_and_services (project_id);

CREATE INDEX IF NOT EXISTS idx_components_inventory_recent
  ON tbl_software_components_and_packages (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_components_project
  ON tbl_software_components_and_packages (project_id);

CREATE INDEX IF NOT EXISTS idx_components_service
  ON tbl_software_components_and_packages (service_id);

CREATE INDEX IF NOT EXISTS idx_sbom_documents_project
  ON tbl_sbom_documents_and_artifacts (project_id);

CREATE INDEX IF NOT EXISTS idx_sbom_document_components_component
  ON tbl_sbom_document_components (software_component_id);

COMMENT ON TABLE tbl_organizations IS 'Company or team that owns the data. Every inventory record belongs to one organization.';
COMMENT ON TABLE tbl_software_inventory IS 'The software inventory for one organization. Components, projects, and SBOM files are stored under this record.';
COMMENT ON TABLE tbl_projects_and_microservices IS 'Projects inside the software inventory. A project name is stored only here.';
COMMENT ON TABLE tbl_project_applications_and_services IS 'Applications and microservices that belong to one project.';
COMMENT ON TABLE tbl_software_components_and_packages IS 'Software components and packages. Points at the project and service instead of copying their names.';
COMMENT ON TABLE tbl_sbom_documents_and_artifacts IS 'SBOM documents and artifact files for a project. Does not copy the component list.';
COMMENT ON TABLE tbl_sbom_document_components IS 'Link between an SBOM file and the inventory components it contains. Stores the link only.';

INSERT INTO tbl_organizations (id, name)
SELECT DISTINCT organization_id, organization_id FROM tbl_scan_runs
WHERE btrim(organization_id) <> ''
ON CONFLICT (id) DO NOTHING;

INSERT INTO tbl_software_inventory (id, organization_id, display_name)
SELECT md5('software-inventory:' || id), id, 'Software inventory'
FROM tbl_organizations
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO tbl_projects_and_microservices (id, software_inventory_id, organization_id, project_name, created_at)
SELECT
  md5(s.organization_id || chr(31) || s.project_id),
  inv.id,
  s.organization_id,
  s.project_id,
  MIN(s.created_at)
FROM tbl_scan_runs s
JOIN tbl_software_inventory inv ON inv.organization_id = s.organization_id
WHERE btrim(s.project_id) <> ''
GROUP BY s.organization_id, s.project_id, inv.id
ON CONFLICT (organization_id, project_name) DO NOTHING;

INSERT INTO tbl_project_applications_and_services (id, project_id, organization_id, service_name, created_at)
SELECT
  md5(p.organization_id || chr(31) || p.id || chr(31) || s.application_name),
  p.id,
  p.organization_id,
  s.application_name,
  MIN(s.created_at)
FROM tbl_scan_runs s
JOIN tbl_projects_and_microservices p
  ON p.organization_id = s.organization_id
 AND p.project_name = s.project_id
WHERE btrim(s.application_name) <> ''
  AND btrim(s.project_id) <> ''
GROUP BY p.organization_id, p.id, s.application_name
ON CONFLICT (organization_id, project_id, service_name) DO NOTHING;

INSERT INTO tbl_sbom_documents_and_artifacts (
  id, software_inventory_id, organization_id, project_id,
  file_name, file_format, file_size_bytes, signature_status,
  uploaded_at, source_snapshot_id, created_at
)
SELECT DISTINCT ON (s.id)
  md5('sbom-document:' || s.id),
  inv.id,
  s.organization_id,
  p.id,
  left(regexp_replace(p.project_name, '[^a-zA-Z0-9._-]+', '-', 'g'), 80) || '-' || left(s.id, 8) ||
    CASE
      WHEN lower(COALESCE(s.bom_format_version, '') || COALESCE(s.bom_type, '')) LIKE '%spdx%' THEN '.spdx.json'
      ELSE '.cdx.json'
    END,
  CASE
    WHEN lower(COALESCE(s.bom_format_version, '') || COALESCE(s.bom_type, '')) LIKE '%spdx%' THEN 'SPDX-2.3'
    ELSE 'CycloneDX-1.5'
  END,
  0,
  'Unsigned',
  s.generated_at,
  s.id,
  s.generated_at
FROM tbl_bom_snapshots s
JOIN tbl_software_inventory inv ON inv.organization_id = s.organization_id
JOIN tbl_projects_and_microservices p
  ON p.organization_id = s.organization_id
 AND p.software_inventory_id = inv.id
 AND (p.id = s.project_id OR p.project_name = s.project_id)
WHERE COALESCE(s.scanner_name, '') <> 'manual'
  AND btrim(s.organization_id) <> ''
ORDER BY s.id, CASE WHEN p.id = s.project_id THEN 0 ELSE 1 END
ON CONFLICT (source_snapshot_id) WHERE source_snapshot_id IS NOT NULL DO NOTHING;

DELETE FROM tbl_bom_components AS c
WHERE c.source_manifest = 'manual'
  AND EXISTS (
    SELECT 1 FROM tbl_software_components_and_packages AS n WHERE n.id = c.id
  );

DELETE FROM tbl_bom_snapshots AS s
WHERE s.scanner_name = 'manual'
  AND NOT EXISTS (
    SELECT 1 FROM tbl_bom_components AS c WHERE c.bom_snapshot_id = s.id
  );
