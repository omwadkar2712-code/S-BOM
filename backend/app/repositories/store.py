"""Scan, snapshot, and credential persistence."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.db import finish


_FIELD_TYPES = {
    "Library",
    "Application",
    "Framework",
    "Container",
    "Service",
    "Operating System",
    "Device / Firmware",
    "File",
}
_RISKS = {"Safe", "Low", "Medium", "High", "Critical"}
_ECOSYSTEM_LABELS = {
    "npm": "npm",
    "pypi": "PyPI",
    "maven": "Maven",
    "go": "Go",
    "cargo": "Cargo",
    "nuget": "NuGet",
    "rubygems": "RubyGems",
    "packagist": "Packagist",
    "composer": "Packagist",
}
_MAX_INVENTORY_BATCH = 5000


def _package_key(comp: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(comp.get("name") or "").strip().lower(),
        str(comp.get("version") or "").strip(),
        str(comp.get("ecosystem") or "").strip().lower(),
    )


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(value: datetime | str | None) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        return value
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _omit(data: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in data.items() if v not in (None, "", [], {})}


class ScanRepo:
    def __init__(self, db) -> None:
        self.db = db

    def create_scan(self, scan: dict[str, Any]) -> None:
        from app.catalog.store import ensure_organization
        from app.repositories.facts import resolve_catalog_ids

        ensure_organization(self.db, scan["organization_id"])
        catalog_project_id, catalog_application_id = resolve_catalog_ids(
            self.db,
            scan["organization_id"],
            scan.get("project_id") or "",
            scan.get("application_id") or scan.get("application_name") or "",
        )
        self.db.execute(
            """INSERT INTO scans (
               id, organization_id, project_id, application_id, application_name,
               application_version, version_strategy, bom_type, source_type, scan_status,
               scan_stage, idempotency_key, created_at, bulk_scan_id, bulk_row_number,
               catalog_project_id, catalog_application_id, repository_url, branch)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                scan["id"], scan["organization_id"], scan["project_id"], scan["application_id"],
                scan["application_name"], scan["application_version"], scan["version_strategy"],
                scan["bom_type"], scan["source_type"], scan["status"], scan["stage"],
                scan["idempotency_key"], iso(scan["created_at"]), scan.get("bulk_scan_id") or None,
                scan.get("bulk_row") or 0, catalog_project_id, catalog_application_id,
                scan.get("repository_url") or "", scan.get("branch") or "",
            ),
        )
        finish(self.db)

    def get_scan(self, scan_id: str) -> dict[str, Any] | None:
        row = self.db.execute(
            """SELECT id, organization_id, project_id, application_id, application_name,
                      application_version, version_strategy, bom_type, source_type, scan_status,
                      scan_stage, error_code, error_message, idempotency_key, created_at,
                      started_at, completed_at, COALESCE(bulk_scan_id,''), bulk_row_number,
                      COALESCE(sbom_id,'')
               FROM scans WHERE id = ?""",
            (scan_id,),
        ).fetchone()
        return _scan_row(row) if row else None

    def find_by_key(self, key: str) -> dict[str, Any] | None:
        row = self.db.execute(
            """SELECT id, organization_id, project_id, application_id, application_name,
                      application_version, version_strategy, bom_type, source_type, scan_status,
                      scan_stage, error_code, error_message, idempotency_key, created_at,
                      started_at, completed_at, COALESCE(bulk_scan_id,''), bulk_row_number,
                      COALESCE(sbom_id,'')
               FROM scans WHERE idempotency_key = ?""",
            (key,),
        ).fetchone()
        return _scan_row(row) if row else None

    def list_scans(self, org_id: str, limit: int = 100) -> list[dict[str, Any]]:
        if limit <= 0 or limit > 500:
            limit = 100
        rows = self.db.execute(
            """SELECT id, organization_id, project_id, application_id, application_name,
                      application_version, version_strategy, bom_type, source_type, scan_status,
                      scan_stage, error_code, error_message, idempotency_key, created_at,
                      started_at, completed_at, COALESCE(bulk_scan_id,''), bulk_row_number,
                      COALESCE(sbom_id,'')
               FROM scans WHERE organization_id = ? AND scan_status <> 'IGNORED' ORDER BY created_at DESC LIMIT ?""",
            (org_id, limit),
        ).fetchall()
        return [_scan_row(row) for row in rows]

    def set_stage(self, scan_id: str, stage: str) -> None:
        self.db.execute(
            "UPDATE scans SET scan_stage = ? WHERE id = ? AND scan_status <> 'CANCELLED'",
            (stage, scan_id),
        )
        finish(self.db)

    def mark_completed(self, scan_id: str, snapshot_id: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans SET scan_status='COMPLETED', scan_stage='COMPLETED', sbom_id=?, completed_at=?
               WHERE id=? AND scan_status <> 'CANCELLED'""",
            (snapshot_id, now, scan_id),
        )
        finish(self.db)

    def mark_failed(self, scan_id: str, code: str, message: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans SET scan_status='FAILED', scan_stage='FAILED', error_code=?, error_message=?, completed_at=?
               WHERE id=? AND scan_status <> 'CANCELLED'""",
            (code, message, now, scan_id),
        )
        finish(self.db)

    def mark_running(self, scan_id: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans SET scan_status='RUNNING', started_at=COALESCE(started_at, ?)
               WHERE id=? AND scan_status IN ('PENDING','QUEUED')""",
            (now, scan_id),
        )
        finish(self.db)

    def mark_cancelled(self, scan_id: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans
               SET scan_status='CANCELLED', scan_stage='CANCELLED', error_code='CANCELLED',
                   error_message='Cancelled by user', completed_at=?
               WHERE id=? AND scan_status IN ('PENDING','QUEUED','RUNNING')""",
            (now, scan_id),
        )
        finish(self.db)

    def reopen(self, scan_id: str) -> None:
        self.db.execute(
            """UPDATE scans SET scan_status='QUEUED', scan_stage='QUEUED', error_code='', error_message='', completed_at=NULL
               WHERE id=? AND scan_status IN ('FAILED','DEAD_LETTER','CANCELLED')""",
            (scan_id,),
        )
        finish(self.db)

    def reset_for_rescan(self, scan_id: str) -> None:
        self.db.execute(
            """UPDATE scans
               SET scan_status='QUEUED', scan_stage='QUEUED', error_code='', error_message='',
                   completed_at=NULL, started_at=NULL, sbom_id=NULL
               WHERE id=? AND scan_status IN ('COMPLETED','FAILED','DEAD_LETTER','CANCELLED')""",
            (scan_id,),
        )
        finish(self.db)

    def record_event(self, scan_id: str, stage: str, message: str, data: Any = None) -> None:
        event = {
            "id": str(uuid.uuid4()),
            "stage": stage,
            "message": message,
            "created_at": iso(utcnow()),
        }
        if data is not None:
            event["data"] = data
        self.db.execute(
            "UPDATE scans SET events = COALESCE(events, '[]'::jsonb) || ?::jsonb WHERE id = ?",
            (json.dumps([event]), scan_id),
        )
        finish(self.db)

    def list_events(self, scan_id: str) -> list[dict[str, Any]]:
        row = self.db.execute("SELECT events FROM scans WHERE id = ?", (scan_id,)).fetchone()
        if row is None or not row["events"]:
            return []
        raw = row["events"]
        events = raw if isinstance(raw, list) else json.loads(raw)
        out = []
        for item in events:
            if not isinstance(item, dict):
                continue
            event = {
                "id": item.get("id") or "",
                "scan_id": scan_id,
                "stage": item.get("stage") or "",
                "message": item.get("message") or "",
                "created_at": item.get("created_at") or "",
            }
            if item.get("data") not in (None, "null"):
                event["data"] = item["data"]
            out.append(event)
        return out


def _scan_row(row) -> dict[str, Any]:
    scan = {
        "id": row[0],
        "organization_id": row[1],
        "project_id": row[2],
        "application_id": row[3],
        "application_name": row[4],
        "application_version": row[5],
        "version_strategy": row[6],
        "bom_type": row[7],
        "source_type": row[8],
        "status": row[9],
        "stage": row[10],
        "error_code": row[11] or "",
        "error_message": row[12] or "",
        "idempotency_key": row[13],
        "created_at": row[14],
        "started_at": row[15],
        "completed_at": row[16],
        "bulk_scan_id": row[17] or "",
        "bulk_row": row[18] or 0,
        "snapshot_id": row[19] or "",
    }
    return scan


def public_scan(scan: dict[str, Any]) -> dict[str, Any]:
    return _omit(
        {
            "id": scan["id"],
            "organization_id": scan["organization_id"],
            "project_id": scan["project_id"],
            "application_id": scan["application_id"],
            "application_name": scan["application_name"],
            "application_version": scan["application_version"],
            "version_strategy": scan["version_strategy"],
            "bom_type": scan["bom_type"],
            "source_type": scan["source_type"],
            "status": scan["status"],
            "stage": scan["stage"],
            "error_code": scan.get("error_code") or None,
            "error_message": scan.get("error_message") or None,
            "idempotency_key": scan["idempotency_key"],
            "created_at": scan["created_at"],
            "started_at": scan.get("started_at"),
            "completed_at": scan.get("completed_at"),
            "bulk_scan_id": scan.get("bulk_scan_id") or None,
            "bulk_row": scan.get("bulk_row") or None,
            "snapshot_id": scan.get("snapshot_id") or None,
            "file_name": scan.get("file_name") or None,
            "repository_url": scan.get("repository_url") or None,
            "branch": scan.get("branch") or None,
        }
    )


class JobQueue:
    def __init__(self, db) -> None:
        self.db = db

    def enqueue(self, job: dict[str, Any]) -> None:
        payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}
        self.db.execute(
            """UPDATE scans
               SET job_status='QUEUED', priority=?, attempts=0, max_attempts=?, job_payload=?,
                   next_attempt_at=?, repository_url=CASE WHEN ? <> '' THEN ? ELSE repository_url END,
                   branch=CASE WHEN ? <> '' THEN ? ELSE branch END
               WHERE id=?""",
            (
                job.get("priority") or 0,
                job.get("max_attempts") or 3,
                json.dumps(payload),
                iso(job["next_attempt_at"]),
                str(payload.get("repository_url") or ""),
                str(payload.get("repository_url") or ""),
                str(payload.get("branch") or ""),
                str(payload.get("branch") or ""),
                job["scan_id"],
            ),
        )
        finish(self.db)

    def claim(self, visibility_seconds: int) -> dict[str, Any] | None:
        now = utcnow()
        deadline = iso(datetime.fromtimestamp(now.timestamp() + visibility_seconds, timezone.utc))
        now_s = iso(now)
        claim_sql = """SELECT id, organization_id, bom_type, source_type, priority, attempts, max_attempts,
                              job_payload AS payload, idempotency_key
                       FROM scans
                       WHERE job_status = 'QUEUED' AND next_attempt_at <= ?
                       ORDER BY priority DESC, created_at ASC
                       LIMIT 1
                       FOR UPDATE SKIP LOCKED"""
        with self.db.lock:
            if self.db.in_transaction:
                self.db.rollback()
            self.db.begin()
            try:
                row = self.db.execute(claim_sql, (now_s,)).fetchone()
                if row is None:
                    self.db.commit()
                    return None
                self.db.execute(
                    """UPDATE scans
                       SET job_status='RUNNING', attempts=attempts+1, job_started_at=?, next_attempt_at=?
                       WHERE id=?""",
                    (now_s, deadline, row["id"]),
                )
                self.db.commit()
            except Exception:
                if self.db.in_transaction:
                    self.db.rollback()
                raise
        return {
            "id": row["id"],
            "scan_id": row["id"],
            "organization_id": row["organization_id"],
            "bom_type": row["bom_type"],
            "source_type": row["source_type"],
            "priority": row["priority"],
            "attempts": row["attempts"] + 1,
            "max_attempts": row["max_attempts"],
            "payload": json.loads(row["payload"] or "{}"),
            "idempotency_key": row["idempotency_key"],
        }

    def complete(self, job_id: str) -> None:
        self.db.execute(
            "UPDATE scans SET job_status='COMPLETED', job_completed_at=? WHERE id=? AND job_status='RUNNING'",
            (iso(utcnow()), job_id),
        )
        finish(self.db)

    def fail(self, job_id: str, code: str, message: str, retryable: bool, next_attempt: datetime) -> None:
        if retryable:
            self.db.execute(
                """UPDATE scans
                   SET job_status = CASE WHEN attempts >= max_attempts THEN 'DEAD_LETTER' ELSE 'QUEUED' END,
                       next_attempt_at = ?, job_error_code = ?, job_error_message = ?
                   WHERE id = ? AND job_status = 'RUNNING'""",
                (iso(next_attempt), code, message, job_id),
            )
        else:
            self.db.execute(
                """UPDATE scans
                   SET job_status='FAILED', job_completed_at=?, job_error_code=?, job_error_message=?
                   WHERE id=? AND job_status='RUNNING'""",
                (iso(utcnow()), code, message, job_id),
            )
        finish(self.db)

    def mark_cancelled(self, job_id: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans
               SET job_status='CANCELLED', job_completed_at=?, job_error_code='CANCELLED',
                   job_error_message='Cancelled by user'
               WHERE id=? AND job_status IN ('PENDING','QUEUED','RUNNING')""",
            (now, job_id),
        )
        finish(self.db)

    def requeue_failed(self, idempotency_key: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans
               SET job_status='QUEUED', attempts=0, next_attempt_at=?, job_completed_at=NULL,
                   job_started_at=NULL, job_error_code='', job_error_message=''
               WHERE idempotency_key=? AND job_status IN ('FAILED','DEAD_LETTER','CANCELLED')""",
            (now, idempotency_key),
        )
        finish(self.db)

    def source_labels(self, scan_ids: list[str]) -> dict[str, dict[str, str]]:
        """File name or repository for each scan, taken from the job payload.

        Credential ids stay in the payload and are not returned.
        """
        if not scan_ids:
            return {}
        marks = ",".join("?" for _ in scan_ids)
        rows = self.db.execute(
            f"SELECT id AS scan_id, job_payload AS payload FROM scans WHERE id IN ({marks})",
            tuple(scan_ids),
        ).fetchall()
        out: dict[str, dict[str, str]] = {}
        for row in rows:
            raw = row["payload"]
            try:
                payload = json.loads(raw) if isinstance(raw, str) else (raw or {})
            except (TypeError, ValueError):
                payload = {}
            if not isinstance(payload, dict):
                payload = {}
            out[row["scan_id"]] = {
                "file_name": str(payload.get("file_name") or ""),
                "repository_url": str(payload.get("repository_url") or ""),
                "branch": str(payload.get("branch") or ""),
            }
        return out

    def get_for_scan(self, scan_id: str) -> dict[str, Any] | None:
        row = self.db.execute(
            "SELECT id, job_status AS status FROM scans WHERE id = ?",
            (scan_id,),
        ).fetchone()
        if row is None or not row["status"]:
            return None
        return {"id": row["id"], "scan_id": row["id"], "status": row["status"]}

    def requeue(self, job_id: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans
               SET job_status='QUEUED', attempts=0, next_attempt_at=?, job_completed_at=NULL,
                   job_started_at=NULL, job_error_code='', job_error_message=''
               WHERE id=? AND job_status IN ('COMPLETED','FAILED','DEAD_LETTER','QUEUED','CANCELLED')""",
            (now, job_id),
        )
        finish(self.db)


class BomRepo:
    def __init__(self, db) -> None:
        self.db = db

    def save_snapshot(self, snap: dict[str, Any]) -> None:
        with self.db.lock:
            self._save_snapshot(snap)

    def _save_snapshot(self, snap: dict[str, Any]) -> None:
        if self.db.in_transaction:
            self.db.rollback()
        self.db.begin()
        try:
            from app.repositories.facts import persist_snapshot_facts, stored_component_raw, stored_metadata

            self._drop_prior_snapshots(snap.get("scan_id") or "")
            self.db.execute(
                """INSERT INTO sboms (
                   id, organization_id, project_id, application_id, scan_id, bom_type,
                   application_version, version_strategy, repository_url, repository_branch,
                   commit_sha, commit_author, commit_email, commit_message, scanner_name,
                   scanner_version, bom_format_version, generated_at, raw_metadata)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    snap["id"], snap.get("organization_id") or "", snap.get("project_id") or "",
                    snap.get("application_id") or "", snap.get("scan_id") or "", snap.get("bom_type") or "SBOM",
                    snap.get("application_version") or "", snap.get("version_strategy") or "",
                    snap.get("repository_url") or "", snap.get("repository_branch") or "",
                    snap.get("commit_sha") or "", snap.get("commit_author") or "", snap.get("commit_email") or "",
                    snap.get("commit_message") or "", snap.get("scanner_name") or "", snap.get("scanner_version") or "",
                    snap.get("bom_format_version") or "", iso(snap.get("generated_at")) or iso(utcnow()),
                    json.dumps(stored_metadata(snap.get("raw_metadata"))),
                ),
            )
            now = iso(utcnow())
            known = self._known_package_keys(snap.get("organization_id") or "")
            seen_in_snapshot: set[tuple[str, str, str]] = set()
            kept: list[dict[str, Any]] = []
            discovered = snap.get("components") or []
            skipped_existing = 0
            for comp in discovered:
                key = _package_key(comp)
                if key in seen_in_snapshot:
                    continue
                seen_in_snapshot.add(key)
                if key in known:
                    skipped_existing += 1
                known.add(key)
                kept.append(comp)
                self.db.execute(
                    """INSERT INTO sbom_components (
                       id, sbom_id, name, version, ecosystem,
                       package_manager, package_url, cpe, content_hash, license_name, supplier_name,
                       dependency_scope, is_direct_dependency, source_manifest, raw_component, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        comp["id"], snap["id"], comp.get("name") or "", comp.get("version") or "",
                        comp.get("ecosystem") or "", comp.get("package_manager") or "", comp.get("purl") or "",
                        comp.get("cpe") or "", comp.get("hash") or "", comp.get("license") or "",
                        comp.get("supplier") or "", comp.get("scope") or "runtime", bool(comp.get("direct")),
                        comp.get("source_manifest") or "", json.dumps(stored_component_raw(comp.get("raw"))), now,
                    ),
                )
            kept_ids = {comp["id"] for comp in kept}
            kept_deps = [
                dep for dep in (snap.get("dependencies") or [])
                if dep.get("from_component_id") in kept_ids and dep.get("to_component_id") in kept_ids
            ]
            snap["dependencies"] = kept_deps
            persist_snapshot_facts(self.db, snap, kept)
            snap["components"] = kept
            snap["components_skipped"] = skipped_existing
            self.db.commit()
        except Exception:
            if self.db.in_transaction:
                self.db.rollback()
            raise

    def _drop_prior_snapshots(self, scan_id: str) -> None:
        if not scan_id:
            return
        rows = self.db.execute("SELECT id FROM sboms WHERE scan_id = ?", (scan_id,)).fetchall()
        for row in rows:
            snapshot_id = row[0]
            self.db.execute("UPDATE scans SET sbom_id = NULL WHERE sbom_id = ?", (snapshot_id,))
            self.db.execute("DELETE FROM sboms WHERE id = ?", (snapshot_id,))

    def _known_package_keys(self, organization_id: str) -> set[tuple[str, str, str]]:
        rows = self.db.execute(
            """SELECT lower(c.name), c.version, lower(c.ecosystem)
               FROM sbom_components c
               JOIN sboms s ON s.id = c.sbom_id
               WHERE s.organization_id = ?""",
            (organization_id,),
        ).fetchall()
        return {(row[0] or "", row[1] or "", row[2] or "") for row in rows}

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        row = self.db.execute(
            """SELECT id, organization_id, project_id, application_id, scan_id,
                      bom_type, application_version, version_strategy,
                      repository_url, repository_branch, commit_sha, commit_author, commit_email,
                      commit_message, scanner_name, scanner_version, bom_format_version,
                      generated_at, raw_metadata, facts_normalized
               FROM sboms WHERE id = ?""",
            (snapshot_id,),
        ).fetchone()
        if row is None:
            return None
        raw = {}
        if row["raw_metadata"]:
            raw = json.loads(row["raw_metadata"])
        snap = {
            "id": row["id"],
            "organization_id": row["organization_id"],
            "project_id": row["project_id"],
            "application_id": row["application_id"],
            "scan_id": row["scan_id"],
            "bom_type": row["bom_type"],
            "application_version": row["application_version"],
            "version_strategy": row["version_strategy"],
            "repository_url": row["repository_url"],
            "repository_branch": row["repository_branch"],
            "commit_sha": row["commit_sha"],
            "commit_author": row["commit_author"],
            "commit_email": row["commit_email"],
            "commit_message": row["commit_message"],
            "scanner_name": row["scanner_name"],
            "scanner_version": row["scanner_version"],
            "bom_format_version": row["bom_format_version"],
            "generated_at": row["generated_at"],
            "raw_metadata": raw,
            "components": self._components(snapshot_id),
            "dependencies": self._deps(snapshot_id),
        }
        if row["facts_normalized"]:
            from app.repositories.facts import overlay_snapshot_facts

            overlay_snapshot_facts(self.db, snap)
        return snap

    def _components(self, snapshot_id: str) -> list[dict[str, Any]]:
        rows = self.db.execute(
            """SELECT id, sbom_id, name, version, ecosystem,
                      package_manager, package_url AS purl, cpe, content_hash AS hash, license_name AS license,
                      supplier_name AS supplier, dependency_scope AS scope, is_direct_dependency AS direct_dependency,
                      source_manifest, raw_component AS raw, dependency_depth
               FROM sbom_components WHERE sbom_id = ? ORDER BY ecosystem, name, version""",
            (snapshot_id,),
        ).fetchall()
        out = []
        for row in rows:
            raw = json.loads(row["raw"]) if row["raw"] else {}
            item = {
                "id": row["id"],
                "sbom_id": row["sbom_id"],
                "name": row["name"],
                "version": row["version"],
                "ecosystem": row["ecosystem"],
                "package_manager": row["package_manager"],
                "purl": row["purl"],
                "scope": row["scope"],
                "direct": bool(row["direct_dependency"]),
                "source_manifest": row["source_manifest"],
            }
            if row["cpe"]:
                item["cpe"] = row["cpe"]
            if row["hash"]:
                item["hash"] = row["hash"]
            if row["license"]:
                item["license"] = row["license"]
            if row["supplier"]:
                item["supplier"] = row["supplier"]
            if row["dependency_depth"] is not None:
                raw = dict(raw)
                raw.setdefault("depth", row["dependency_depth"])
            if raw:
                item["raw"] = raw
            out.append(item)
        return out

    def _deps(self, snapshot_id: str) -> list[dict[str, Any]]:
        rows = self.db.execute(
            "SELECT id, sbom_id, depends_on FROM sbom_components WHERE sbom_id = ?",
            (snapshot_id,),
        ).fetchall()
        out = []
        for row in rows:
            children = row["depends_on"] or []
            for child in children:
                out.append(
                    {
                        "id": f"{row['id']}:{child}",
                        "sbom_id": row["sbom_id"],
                        "from_component_id": row["id"],
                        "to_component_id": child,
                        "kind": "runtime",
                    }
                )
        return out

    def list_for_application(self, app_id: str, limit: int = 50) -> list[dict[str, Any]]:
        if limit <= 0 or limit > 500:
            limit = 100
        rows = self.db.execute(
            "SELECT id FROM sboms WHERE application_id = ? ORDER BY generated_at DESC LIMIT ?",
            (app_id, limit),
        ).fetchall()
        return [snap for row in rows if (snap := self.get_snapshot(row["id"]))]

    def list_inventory_components(
        self,
        organization_id: str,
        *,
        limit: int = 200,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        page_size = min(max(int(limit or 200), 1), 500)
        params: list[Any] = [organization_id]
        cursor_sql = ""
        if cursor:
            created_at, component_id = _decode_cursor(cursor)
            cursor_sql = "AND (c.created_at, c.id) < (?, ?)"
            params.extend([created_at, component_id])
        params.append(page_size + 1)
        rows = self.db.execute(
            f"""SELECT c.id, c.name, c.version, c.ecosystem, c.package_url AS purl,
                      c.license_name AS license, c.supplier_name AS supplier, c.is_direct_dependency AS direct_dependency,
                      c.package_name, c.component_type AS field_type, c.risk_level AS risk,
                      c.vulnerability_count AS cve_count, c.source_file_name AS file_name, c.created_by,
                      c.created_at, p.name AS project_name, a.name AS application_name
               FROM inventory_components c
               JOIN projects p ON p.id = c.project_id
               JOIN applications a ON a.id = c.application_id
               WHERE c.organization_id = ?
               {cursor_sql}
               ORDER BY c.created_at DESC, c.id DESC
               LIMIT ?""",
            params,
        ).fetchall()
        page = rows[:page_size]
        next_cursor = None
        if len(rows) > page_size and page:
            last = page[-1]
            next_cursor = _encode_cursor(last["created_at"], last["id"])
        return {"items": [_inventory_component(row) for row in page], "next_cursor": next_cursor}

    def add_inventory_components(self, organization_id: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not isinstance(items, list) or not items:
            raise ValueError("components are required")
        if len(items) > _MAX_INVENTORY_BATCH:
            raise ValueError(f"at most {_MAX_INVENTORY_BATCH} components can be saved at once")
        prepared = [_prepare_inventory_component(item) for item in items]
        now = iso(utcnow()) or ""
        created: list[dict[str, Any]] = []
        with self.db.lock:
            if self.db.in_transaction:
                self.db.rollback()
            self.db.begin()
            try:
                from app.catalog.store import ensure_organization

                ensure_organization(self.db, organization_id)
                project_ids = self._upsert_projects(
                    organization_id, list(dict.fromkeys(item["project"] for item in prepared))
                )
                applications = list(dict.fromkeys((item["project"], item["project_application"]) for item in prepared))
                application_ids = self._upsert_applications(organization_id, applications, project_ids)
                component_rows = []
                for item in prepared:
                    component_id = str(uuid.uuid4())
                    project_id = project_ids[item["project"]]
                    application_id = application_ids[(project_id, item["project_application"])]
                    component_rows.append(
                        (
                            component_id, organization_id, project_id, application_id,
                            item["name"], item["package_name"], item["version"], item["field_type"],
                            item["file_name"], item["license"], item["purl"], item["ecosystem_key"],
                            item["risk"], item["cves"], item["direct"], item["supplier"], item["created_by"], now,
                        )
                    )
                    created.append(
                        {
                            "id": component_id,
                            "name": item["name"],
                            "package_name": item["package_name"],
                            "version": item["version"],
                            "project": item["project"],
                            "project_application": item["project_application"],
                            "field_type": item["field_type"],
                            "file_name": item["file_name"],
                            "license": item["license"],
                            "cves": item["cves"],
                            "purl": item["purl"],
                            "risk": item["risk"],
                            "ecosystem": item["ecosystem_label"],
                            "direct": item["direct"],
                            "supplier": item["supplier"],
                            "created_by": item["created_by"],
                        }
                    )
                self.db.executemany(
                    """INSERT INTO inventory_components (
                       id, organization_id, project_id, application_id,
                       name, package_name, version, component_type, source_file_name,
                       license_name, package_url, ecosystem, risk_level, vulnerability_count,
                       is_direct_dependency, supplier_name, created_by, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    component_rows,
                )
                self.db.commit()
            except Exception:
                if self.db.in_transaction:
                    self.db.rollback()
                raise
        return created

    def _upsert_projects(self, organization_id: str, names: list[str]) -> dict[str, str]:
        _insert_ignore(
            self.db,
            "INSERT INTO projects (id, organization_id, name)",
            "ON CONFLICT (organization_id, name) DO NOTHING",
            [(str(uuid.uuid4()), organization_id, name) for name in names],
        )
        rows = self.db.execute(
            """SELECT id, name FROM projects
               WHERE organization_id = ? AND name = ANY(?)""",
            (organization_id, names),
        ).fetchall()
        return {row["name"]: row["id"] for row in rows}

    def _upsert_applications(
        self,
        organization_id: str,
        applications: list[tuple[str, str]],
        project_ids: dict[str, str],
    ) -> dict[tuple[str, str], str]:
        rows = [
            (str(uuid.uuid4()), organization_id, project_ids[project], name)
            for project, name in applications
        ]
        _insert_ignore(
            self.db,
            "INSERT INTO applications (id, project_id, organization_id, name)",
            "ON CONFLICT (organization_id, project_id, name) DO NOTHING",
            [(row[0], row[2], row[1], row[3]) for row in rows],
        )
        found = self.db.execute(
            """SELECT id, project_id, name FROM applications
               WHERE organization_id = ? AND project_id = ANY(?)""",
            (organization_id, list({row[2] for row in rows})),
        ).fetchall()
        wanted = {(project_ids[project], name) for project, name in applications}
        return {(row["project_id"], row["name"]): row["id"] for row in found if (row["project_id"], row["name"]) in wanted}


def _prepare_inventory_component(item: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise ValueError("each component must be an object")
    project = _clip(item.get("project") or item.get("project_name"))
    application = _clip(item.get("project_application") or item.get("projectApplication"))
    name = _clip(item.get("name"))
    version = _clip(item.get("version"))
    if not project or not application or not name or not version:
        raise ValueError("project, project application, component name, and version are required")
    package_name = _clip(item.get("package_name") or item.get("packageName")) or name
    field_type = _clip(item.get("field_type") or item.get("fieldType")) or "Library"
    if field_type not in _FIELD_TYPES:
        raise ValueError("field type is not supported")
    risk = _clip(item.get("risk")) or "Safe"
    if risk not in _RISKS:
        raise ValueError("risk level is not supported")
    ecosystem_key, ecosystem_label = _ecosystem(item.get("ecosystem"))
    license_name = _clip(item.get("license"), 200) or "Unknown"
    purl = _clip(item.get("purl"), 1000) or f"pkg:{ecosystem_key}/{package_name}@{version}"
    supplier = _clip(item.get("supplier"), 300) or "Registered Software Component"
    file_name = _clip(item.get("file_name") or item.get("fileName"), 300)
    created_by = _clip(item.get("created_by") or item.get("createdBy"), 200)
    cves = _cve_count(item.get("cves"))
    direct = item.get("direct_dependency")
    if direct is None:
        direct = item.get("direct")
    if direct is None:
        direct = True
    return {
        "project": project,
        "project_application": application,
        "name": name,
        "package_name": package_name,
        "version": version,
        "field_type": field_type,
        "license": license_name,
        "cves": cves,
        "purl": purl,
        "risk": risk,
        "ecosystem_key": ecosystem_key,
        "ecosystem_label": ecosystem_label,
        "direct": bool(direct),
        "supplier": supplier,
        "file_name": file_name,
        "created_by": created_by,
    }


def _insert_ignore(db, sql_head: str, conflict: str, rows: list[tuple], chunk: int = 400) -> None:
    if not rows:
        return
    width = len(rows[0])
    for start in range(0, len(rows), chunk):
        part = rows[start:start + chunk]
        placeholders = ",".join("(" + ",".join("?" for _ in range(width)) + ")" for _ in part)
        params = [value for row in part for value in row]
        db.execute(f"{sql_head} VALUES {placeholders} {conflict}", params)


def _encode_cursor(created_at: str, component_id: str) -> str:
    return f"{created_at}|{component_id}"


def _decode_cursor(cursor: str) -> tuple[str, str]:
    created_at, separator, component_id = str(cursor or "").partition("|")
    if not separator or not created_at or not component_id:
        raise ValueError("cursor is invalid")
    return created_at, component_id


def _inventory_component(row) -> dict[str, Any]:
    ecosystem = _ECOSYSTEM_LABELS.get(str(row["ecosystem"] or "").lower(), row["ecosystem"] or "npm")
    try:
        cves = int(row["cve_count"] or 0)
    except (TypeError, ValueError, KeyError):
        cves = 0
    return {
        "id": row["id"],
        "name": row["name"],
        "package_name": row["package_name"] or row["name"],
        "version": row["version"],
        "project": row["project_name"],
        "project_application": row["application_name"],
        "field_type": row["field_type"] or "Library",
        "file_name": row["file_name"] or "",
        "license": row["license"] or "Unknown",
        "cves": cves,
        "purl": row["purl"] or "",
        "risk": row["risk"] or "Safe",
        "ecosystem": ecosystem,
        "direct": bool(row["direct_dependency"]),
        "supplier": row["supplier"] or "",
        "created_by": row["created_by"] or "",
    }


def _ecosystem(value: Any) -> tuple[str, str]:
    key = str(value or "").strip().lower()
    if key in _ECOSYSTEM_LABELS:
        label = _ECOSYSTEM_LABELS[key]
        stored = "packagist" if key == "composer" else key
        return stored, label
    return "npm", "npm"


def _cve_count(value: Any) -> int:
    if value is None or value == "":
        return 0
    try:
        count = int(value)
    except (TypeError, ValueError):
        raise ValueError("vulnerabilities must be a number") from None
    if count < 0:
        raise ValueError("vulnerabilities cannot be negative")
    return count


def _clip(value: Any, limit: int = 500) -> str:
    return str(value or "").strip()[:limit]
