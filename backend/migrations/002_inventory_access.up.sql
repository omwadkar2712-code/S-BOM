-- Catalog fields and access paths for manually added inventory.
-- Writes resolve a project, application, and manual snapshot once, then append components.
-- Reads walk newest-first by (created_at, id) without scanning scan results.

ALTER TABLE bom_components ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '';
ALTER TABLE bom_components ADD COLUMN IF NOT EXISTS package_name TEXT NOT NULL DEFAULT '';
ALTER TABLE bom_components ADD COLUMN IF NOT EXISTS field_type TEXT NOT NULL DEFAULT '';
ALTER TABLE bom_components ADD COLUMN IF NOT EXISTS risk TEXT NOT NULL DEFAULT '';
ALTER TABLE bom_components ADD COLUMN IF NOT EXISTS cve_count INTEGER NOT NULL DEFAULT 0;

UPDATE bom_components AS c
SET organization_id = s.organization_id
FROM bom_snapshots AS s
WHERE c.bom_snapshot_id = s.id
  AND c.source_manifest = 'manual'
  AND c.organization_id = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_org_name
  ON projects (organization_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_org_project_name
  ON applications (organization_id, project_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bom_snapshots_manual
  ON bom_snapshots (organization_id, project_id, application_id)
  WHERE scanner_name = 'manual';

CREATE INDEX IF NOT EXISTS idx_comp_manual_recent
  ON bom_components (organization_id, created_at DESC, id DESC)
  WHERE source_manifest = 'manual';
