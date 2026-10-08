-- Move rows from the old unprefixed scan tables into tbl_security_scans and its children.
-- Fresh databases never had those tables, so each copy is skipped when the source is gone.

INSERT INTO tbl_security_scans (id, organization_id, display_name)
SELECT md5('security-scans:' || id), id, 'Security scans'
FROM tbl_organizations
ON CONFLICT (organization_id) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.scans') IS NOT NULL THEN
    INSERT INTO tbl_organizations (id, name)
    SELECT DISTINCT organization_id, organization_id FROM scans
    WHERE btrim(organization_id) <> ''
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tbl_security_scans (id, organization_id, display_name)
    SELECT md5('security-scans:' || id), id, 'Security scans'
    FROM tbl_organizations
    ON CONFLICT (organization_id) DO NOTHING;
  END IF;

  IF to_regclass('public.git_credentials') IS NOT NULL THEN
    INSERT INTO tbl_organizations (id, name)
    SELECT DISTINCT organization_id, organization_id FROM git_credentials
    WHERE btrim(organization_id) <> ''
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tbl_security_scans (id, organization_id, display_name)
    SELECT md5('security-scans:' || id), id, 'Security scans'
    FROM tbl_organizations
    ON CONFLICT (organization_id) DO NOTHING;
  END IF;

  IF to_regclass('public.bulk_scans') IS NOT NULL THEN
    INSERT INTO tbl_organizations (id, name)
    SELECT DISTINCT organization_id, organization_id FROM bulk_scans
    WHERE btrim(organization_id) <> ''
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tbl_security_scans (id, organization_id, display_name)
    SELECT md5('security-scans:' || id), id, 'Security scans'
    FROM tbl_organizations
    ON CONFLICT (organization_id) DO NOTHING;

    INSERT INTO tbl_bulk_scans (
      id, security_scans_id, organization_id, project_id, bulk_status, file_name,
      total_rows, invalid_rows, created_at, completed_at, validation_errors
    )
    SELECT
      b.id, ws.id, b.organization_id, b.project_id, b.status, b.filename,
      b.total_rows, b.invalid_rows, b.created_at, b.completed_at, b.validation_errors
    FROM bulk_scans b
    JOIN tbl_security_scans ws ON ws.organization_id = b.organization_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.scans') IS NOT NULL THEN
    INSERT INTO tbl_scan_runs (
      id, security_scans_id, organization_id, project_id, application_id, application_name,
      application_version, version_strategy, bom_type, source_type, scan_status, scan_stage,
      error_code, error_message, idempotency_key, created_at, started_at, completed_at,
      bulk_scan_id, bulk_row_number
    )
    SELECT
      s.id, ws.id, s.organization_id, s.project_id, s.application_id, s.application_name,
      s.application_version, s.version_strategy, s.bom_type, s.source_type, s.status, s.stage,
      s.error_code, s.error_message, s.idempotency_key, s.created_at, s.started_at, s.completed_at,
      CASE
        WHEN EXISTS (SELECT 1 FROM tbl_bulk_scans b WHERE b.id = s.bulk_scan_id) THEN s.bulk_scan_id
        ELSE NULL
      END,
      COALESCE(s.bulk_row, 0)
    FROM scans s
    JOIN tbl_security_scans ws ON ws.organization_id = s.organization_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.scan_jobs') IS NOT NULL THEN
    INSERT INTO tbl_scan_jobs (
      id, scan_run_id, security_scans_id, organization_id, bom_type, source_type, priority,
      job_status, attempts, max_attempts, job_payload, created_at, started_at, completed_at,
      next_attempt_at, error_code, error_message, idempotency_key
    )
    SELECT
      j.id, j.scan_id, r.security_scans_id, j.organization_id, j.bom_type, j.source_type, j.priority,
      j.status, j.attempts, j.max_attempts, j.payload, j.created_at, j.started_at, j.completed_at,
      j.next_attempt_at, j.error_code, j.error_message, j.idempotency_key
    FROM scan_jobs j
    JOIN tbl_scan_runs r ON r.id = j.scan_id AND r.organization_id = j.organization_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.scan_events') IS NOT NULL THEN
    INSERT INTO tbl_scan_events (
      id, scan_run_id, security_scans_id, scan_stage, event_message, event_data, created_at
    )
    SELECT e.id, e.scan_id, r.security_scans_id, e.stage, e.message, e.data, e.created_at
    FROM scan_events e
    JOIN tbl_scan_runs r ON r.id = e.scan_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.bom_snapshots') IS NOT NULL THEN
    INSERT INTO tbl_bom_snapshots (
      id, security_scans_id, organization_id, project_id, application_id, scan_run_id,
      bom_type, application_version, version_strategy, repository_url, repository_branch,
      commit_sha, commit_author, commit_email, commit_message, scanner_name, scanner_version,
      bom_format_version, generated_at, raw_metadata
    )
    SELECT
      s.id, r.security_scans_id, s.organization_id, s.project_id, s.application_id, s.scan_id,
      s.bom_type, s.application_version, s.version_strategy, s.repository_url, s.repository_branch,
      s.commit_sha, s.commit_author, s.commit_email, s.commit_message, s.scanner_name, s.scanner_version,
      s.bom_format_version, s.generated_at, s.raw_metadata
    FROM bom_snapshots s
    JOIN tbl_scan_runs r ON r.id = s.scan_id AND r.organization_id = s.organization_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.bom_components') IS NOT NULL THEN
    INSERT INTO tbl_bom_components (
      id, bom_snapshot_id, component_name, component_version, ecosystem, package_manager,
      package_url, cpe, content_hash, license_name, supplier_name, dependency_scope,
      is_direct_dependency, source_manifest, raw_component, created_at
    )
    SELECT
      c.id, c.bom_snapshot_id, c.name, c.version, c.ecosystem, c.package_manager,
      c.purl, c.cpe, c.hash, c.license, c.supplier, c.scope,
      c.direct_dependency, c.source_manifest, c.raw, c.created_at
    FROM bom_components c
    JOIN tbl_bom_snapshots s ON s.id = c.bom_snapshot_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.bom_dependencies') IS NOT NULL THEN
    INSERT INTO tbl_bom_dependencies (
      id, bom_snapshot_id, from_component_id, to_component_id, dependency_kind
    )
    SELECT d.id, d.bom_snapshot_id, d.from_component_id, d.to_component_id, d.kind
    FROM bom_dependencies d
    JOIN tbl_bom_components src
      ON src.id = d.from_component_id AND src.bom_snapshot_id = d.bom_snapshot_id
    JOIN tbl_bom_components dst
      ON dst.id = d.to_component_id AND dst.bom_snapshot_id = d.bom_snapshot_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.scans') IS NOT NULL THEN
    UPDATE tbl_scan_runs AS r
    SET bom_snapshot_id = s.snapshot_id
    FROM scans AS s
    WHERE r.id = s.id
      AND s.snapshot_id IS NOT NULL
      AND btrim(s.snapshot_id) <> ''
      AND EXISTS (SELECT 1 FROM tbl_bom_snapshots b WHERE b.id = s.snapshot_id);
  END IF;

  IF to_regclass('public.credential_secrets') IS NOT NULL THEN
    INSERT INTO tbl_credential_secrets (secret_reference, nonce, ciphertext)
    SELECT reference, nonce, ciphertext FROM credential_secrets
    ON CONFLICT (secret_reference) DO NOTHING;
  END IF;

  IF to_regclass('public.git_credentials') IS NOT NULL THEN
    INSERT INTO tbl_git_credentials (
      id, security_scans_id, organization_id, provider, credential_type, credential_name,
      secret_reference, repository_scope, credential_status, created_at, updated_at,
      last_validated_at, expires_at
    )
    SELECT
      g.id, ws.id, g.organization_id, g.provider, g.credential_type, g.name,
      CASE
        WHEN EXISTS (SELECT 1 FROM tbl_credential_secrets sec WHERE sec.secret_reference = g.secret_reference)
          THEN g.secret_reference
        ELSE NULL
      END,
      g.repository_scope, g.status, g.created_at, g.updated_at, g.last_validated_at, g.expires_at
    FROM git_credentials g
    JOIN tbl_security_scans ws ON ws.organization_id = g.organization_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.bulk_scan_items') IS NOT NULL THEN
    INSERT INTO tbl_bulk_scan_items (
      id, bulk_scan_id, source_row_number, scan_run_id, project_name, application_name,
      application_version, repository_url, item_status, error_code, error_message,
      started_at, completed_at
    )
    SELECT
      i.id, i.bulk_scan_id, i.row_number,
      CASE WHEN EXISTS (SELECT 1 FROM tbl_scan_runs r WHERE r.id = i.scan_id) THEN i.scan_id ELSE NULL END,
      i.project_name, i.application_name, i.version, i.repository_url, i.status,
      i.error_code, i.error_message, i.started_at, i.completed_at
    FROM bulk_scan_items i
    JOIN tbl_bulk_scans b ON b.id = i.bulk_scan_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.webhook_events') IS NOT NULL THEN
    INSERT INTO tbl_webhook_events (
      id, provider, event_type, delivery_id, received_at, is_processed
    )
    SELECT id, provider, event_type, delivery_id, received_at, processed
    FROM webhook_events
    ON CONFLICT (provider, delivery_id) DO NOTHING;
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    INSERT INTO tbl_organizations (id, name)
    SELECT DISTINCT organization_id, organization_id FROM audit_logs
    WHERE organization_id IS NOT NULL AND btrim(organization_id) <> ''
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tbl_security_scans (id, organization_id, display_name)
    SELECT md5('security-scans:' || id), id, 'Security scans'
    FROM tbl_organizations
    ON CONFLICT (organization_id) DO NOTHING;

    INSERT INTO tbl_audit_logs (
      id, audit_kind, security_scans_id, organization_id, actor_id, scan_run_id,
      credential_id, repository_name, audit_metadata, created_at
    )
    SELECT
      a.id,
      a.kind,
      ws.id,
      NULLIF(btrim(a.organization_id), ''),
      NULLIF(btrim(a.actor_id), ''),
      CASE WHEN r.id IS NOT NULL THEN a.scan_id ELSE NULL END,
      CASE WHEN g.id IS NOT NULL THEN a.credential_id ELSE NULL END,
      NULLIF(btrim(a.repository), ''),
      a.metadata,
      a.created_at
    FROM audit_logs a
    LEFT JOIN tbl_security_scans ws ON ws.organization_id = a.organization_id
    LEFT JOIN tbl_scan_runs r ON r.id = a.scan_id
    LEFT JOIN tbl_git_credentials g ON g.id = a.credential_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('public.tbl_sbom_documents_and_artifacts') IS NOT NULL THEN
    UPDATE tbl_sbom_documents_and_artifacts AS d
    SET source_snapshot_id = NULL
    WHERE d.source_snapshot_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM tbl_bom_snapshots AS b WHERE b.id = d.source_snapshot_id
      );

    ALTER TABLE tbl_sbom_documents_and_artifacts
      DROP CONSTRAINT IF EXISTS tbl_sbom_documents_and_artifacts_source_snapshot_id_fkey;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'fk_sbom_documents_source_snapshot'
    ) THEN
      ALTER TABLE tbl_sbom_documents_and_artifacts
        ADD CONSTRAINT fk_sbom_documents_source_snapshot
        FOREIGN KEY (source_snapshot_id) REFERENCES tbl_bom_snapshots (id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS repository_connections CASCADE;
DROP TABLE IF EXISTS repositories CASCADE;
DROP TABLE IF EXISTS component_vulnerabilities CASCADE;
DROP TABLE IF EXISTS vulnerabilities CASCADE;
DROP TABLE IF EXISTS exports CASCADE;
DROP TABLE IF EXISTS scanner_versions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS bulk_scan_items CASCADE;
DROP TABLE IF EXISTS bulk_scans CASCADE;
DROP TABLE IF EXISTS credential_secrets CASCADE;
DROP TABLE IF EXISTS git_credentials CASCADE;
DROP TABLE IF EXISTS bom_dependencies CASCADE;
DROP TABLE IF EXISTS bom_components CASCADE;
DROP TABLE IF EXISTS bom_snapshots CASCADE;
DROP TABLE IF EXISTS scan_events CASCADE;
DROP TABLE IF EXISTS scan_jobs CASCADE;
DROP TABLE IF EXISTS scans CASCADE;
