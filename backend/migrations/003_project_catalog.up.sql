-- Catalog lookup support for Project → Application/Service dependent dropdowns.
-- Backfill scan-originated names into the existing projects/applications tables
-- so the catalog APIs return stable IDs instead of free-text labels.
-- Formal FKs from scans.project_id are not added: that column historically
-- stores the project name for dashboard display, not the catalog UUID.

CREATE INDEX IF NOT EXISTS idx_applications_org_project_id
  ON applications (organization_id, project_id);

CREATE INDEX IF NOT EXISTS idx_projects_org_id
  ON projects (organization_id, id);

INSERT INTO projects (id, organization_id, name, created_at)
SELECT
  md5(s.organization_id || chr(31) || s.project_id),
  s.organization_id,
  s.project_id,
  MIN(s.created_at)
FROM scans s
WHERE s.project_id <> ''
GROUP BY s.organization_id, s.project_id
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO applications (id, organization_id, project_id, name, created_at)
SELECT
  md5(p.organization_id || chr(31) || p.id || chr(31) || s.application_name),
  p.organization_id,
  p.id,
  s.application_name,
  MIN(s.created_at)
FROM scans s
JOIN projects p
  ON p.organization_id = s.organization_id
 AND p.name = s.project_id
WHERE s.application_name <> ''
  AND s.project_id <> ''
GROUP BY p.organization_id, p.id, s.application_name
ON CONFLICT (organization_id, project_id, name) DO NOTHING;
