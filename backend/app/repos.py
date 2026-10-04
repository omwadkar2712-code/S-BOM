"""Scan, snapshot, and credential persistence."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from .db import finish


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
        self.db.execute(
            """INSERT INTO scans (id, organization_id, project_id, application_id,
               application_name, application_version, version_strategy, bom_type,
               source_type, status, stage, idempotency_key, created_at, bulk_scan_id, bulk_row)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                scan["id"], scan["organization_id"], scan["project_id"], scan["application_id"],
                scan["application_name"], scan["application_version"], scan["version_strategy"],
                scan["bom_type"], scan["source_type"], scan["status"], scan["stage"],
                scan["idempotency_key"], iso(scan["created_at"]), scan.get("bulk_scan_id") or None,
                scan.get("bulk_row") or 0,
            ),
        )
        finish(self.db)

    def get_scan(self, scan_id: str) -> dict[str, Any] | None:
        row = self.db.execute(
            """SELECT id, organization_id, project_id, application_id, application_name,
                      application_version, version_strategy, bom_type, source_type, status,
                      stage, error_code, error_message, idempotency_key, created_at,
                      started_at, completed_at, COALESCE(bulk_scan_id,''), bulk_row,
                      COALESCE(snapshot_id,'')
               FROM scans WHERE id = ?""",
            (scan_id,),
        ).fetchone()
        return _scan_row(row) if row else None

    def find_by_key(self, key: str) -> dict[str, Any] | None:
        row = self.db.execute(
            """SELECT id, organization_id, project_id, application_id, application_name,
                      application_version, version_strategy, bom_type, source_type, status,
                      stage, error_code, error_message, idempotency_key, created_at,
                      started_at, completed_at, COALESCE(bulk_scan_id,''), bulk_row,
                      COALESCE(snapshot_id,'')
               FROM scans WHERE idempotency_key = ?""",
            (key,),
        ).fetchone()
        return _scan_row(row) if row else None

    def list_scans(self, org_id: str, limit: int = 100) -> list[dict[str, Any]]:
        if limit <= 0 or limit > 500:
            limit = 100
        rows = self.db.execute(
            """SELECT id, organization_id, project_id, application_id, application_name,
                      application_version, version_strategy, bom_type, source_type, status,
                      stage, error_code, error_message, idempotency_key, created_at,
                      started_at, completed_at, COALESCE(bulk_scan_id,''), bulk_row,
                      COALESCE(snapshot_id,'')
               FROM scans WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?""",
            (org_id, limit),
        ).fetchall()
        return [_scan_row(row) for row in rows]

    def set_stage(self, scan_id: str, stage: str) -> None:
        self.db.execute(
            "UPDATE scans SET stage = ? WHERE id = ? AND status <> 'CANCELLED'",
            (stage, scan_id),
        )
        finish(self.db)

    def mark_completed(self, scan_id: str, snapshot_id: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans SET status='COMPLETED', stage='COMPLETED', snapshot_id=?, completed_at=?
               WHERE id=? AND status <> 'CANCELLED'""",
            (snapshot_id, now, scan_id),
        )
        finish(self.db)

    def mark_failed(self, scan_id: str, code: str, message: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans SET status='FAILED', stage='FAILED', error_code=?, error_message=?, completed_at=?
               WHERE id=? AND status <> 'CANCELLED'""",
            (code, message, now, scan_id),
        )
        finish(self.db)

    def mark_running(self, scan_id: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans SET status='RUNNING', started_at=COALESCE(started_at, ?)
               WHERE id=? AND status IN ('PENDING','QUEUED')""",
            (now, scan_id),
        )
        finish(self.db)

    def mark_cancelled(self, scan_id: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scans
               SET status='CANCELLED', stage='CANCELLED', error_code='CANCELLED',
                   error_message='Cancelled by user', completed_at=?
               WHERE id=? AND status IN ('PENDING','QUEUED','RUNNING')""",
            (now, scan_id),
        )
        finish(self.db)

    def reopen(self, scan_id: str) -> None:
        self.db.execute(
            """UPDATE scans SET status='QUEUED', stage='QUEUED', error_code='', error_message='', completed_at=NULL
               WHERE id=? AND status IN ('FAILED','DEAD_LETTER','CANCELLED')""",
            (scan_id,),
        )
        finish(self.db)

    def reset_for_rescan(self, scan_id: str) -> None:
        self.db.execute(
            """UPDATE scans
               SET status='QUEUED', stage='QUEUED', error_code='', error_message='',
                   completed_at=NULL, started_at=NULL, snapshot_id=NULL
               WHERE id=? AND status IN ('COMPLETED','FAILED','DEAD_LETTER','CANCELLED')""",
            (scan_id,),
        )
        finish(self.db)

    def record_event(self, scan_id: str, stage: str, message: str, data: Any = None) -> None:
        self.db.execute(
            "INSERT INTO scan_events (id, scan_id, stage, message, data, created_at) VALUES (?,?,?,?,?,?)",
            (str(uuid.uuid4()), scan_id, stage, message, json.dumps(data) if data is not None else "null", iso(utcnow())),
        )
        finish(self.db)

    def list_events(self, scan_id: str) -> list[dict[str, Any]]:
        rows = self.db.execute(
            "SELECT id, scan_id, stage, message, data, created_at FROM scan_events WHERE scan_id = ? ORDER BY created_at ASC",
            (scan_id,),
        ).fetchall()
        out = []
        for row in rows:
            item = {
                "id": row["id"],
                "scan_id": row["scan_id"],
                "stage": row["stage"],
                "message": row["message"],
                "created_at": row["created_at"],
            }
            if row["data"] and row["data"] != "null":
                item["data"] = json.loads(row["data"])
            out.append(item)
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
        self.db.execute(
            """INSERT INTO scan_jobs (id, scan_id, organization_id, bom_type, source_type,
               priority, status, attempts, max_attempts, payload, created_at, next_attempt_at, idempotency_key)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT (idempotency_key) DO NOTHING""",
            (
                job["id"], job["scan_id"], job["organization_id"], job["bom_type"], job["source_type"],
                job.get("priority") or 0, "QUEUED", 0, job.get("max_attempts") or 3,
                json.dumps(job["payload"]), iso(job["created_at"]), iso(job["next_attempt_at"]), job["idempotency_key"],
            ),
        )
        finish(self.db)

    def claim(self, visibility_seconds: int) -> dict[str, Any] | None:
        now = utcnow()
        deadline = iso(datetime.fromtimestamp(now.timestamp() + visibility_seconds, timezone.utc))
        now_s = iso(now)
        claim_sql = """SELECT id, scan_id, organization_id, bom_type, source_type, priority,
                              status, attempts, max_attempts, payload, created_at, next_attempt_at, idempotency_key
                       FROM scan_jobs
                       WHERE status = 'QUEUED' AND next_attempt_at <= ?
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
                    """UPDATE scan_jobs SET status='RUNNING', attempts=attempts+1, started_at=?, next_attempt_at=? WHERE id=?""",
                    (now_s, deadline, row["id"]),
                )
                self.db.commit()
            except Exception:
                if self.db.in_transaction:
                    self.db.rollback()
                raise
        return {
            "id": row["id"],
            "scan_id": row["scan_id"],
            "organization_id": row["organization_id"],
            "bom_type": row["bom_type"],
            "source_type": row["source_type"],
            "priority": row["priority"],
            "attempts": row["attempts"] + 1,
            "max_attempts": row["max_attempts"],
            "payload": json.loads(row["payload"]),
            "idempotency_key": row["idempotency_key"],
        }

    def complete(self, job_id: str) -> None:
        self.db.execute(
            "UPDATE scan_jobs SET status='COMPLETED', completed_at=? WHERE id=? AND status='RUNNING'",
            (iso(utcnow()), job_id),
        )
        finish(self.db)

    def fail(self, job_id: str, code: str, message: str, retryable: bool, next_attempt: datetime) -> None:
        if retryable:
            self.db.execute(
                """UPDATE scan_jobs
                   SET status = CASE WHEN attempts >= max_attempts THEN 'DEAD_LETTER' ELSE 'QUEUED' END,
                       next_attempt_at = ?, error_code = ?, error_message = ?
                   WHERE id = ? AND status = 'RUNNING'""",
                (iso(next_attempt), code, message, job_id),
            )
        else:
            self.db.execute(
                "UPDATE scan_jobs SET status='FAILED', completed_at=?, error_code=?, error_message=? WHERE id=? AND status='RUNNING'",
                (iso(utcnow()), code, message, job_id),
            )
        finish(self.db)

    def mark_cancelled(self, job_id: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scan_jobs
               SET status='CANCELLED', completed_at=?, error_code='CANCELLED', error_message='Cancelled by user'
               WHERE id=? AND status IN ('PENDING','QUEUED','RUNNING')""",
            (now, job_id),
        )
        finish(self.db)

    def requeue_failed(self, idempotency_key: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scan_jobs
               SET status='QUEUED', attempts=0, next_attempt_at=?, completed_at=NULL,
                   started_at=NULL, error_code='', error_message=''
               WHERE idempotency_key=? AND status IN ('FAILED','DEAD_LETTER','CANCELLED')""",
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
            f"SELECT scan_id, payload FROM scan_jobs WHERE scan_id IN ({marks})",
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
            """SELECT id, scan_id, status
               FROM scan_jobs WHERE scan_id = ? ORDER BY created_at DESC LIMIT 1""",
            (scan_id,),
        ).fetchone()
        if row is None:
            return None
        return {"id": row["id"], "scan_id": row["scan_id"], "status": row["status"]}

    def requeue(self, job_id: str) -> None:
        now = iso(utcnow())
        self.db.execute(
            """UPDATE scan_jobs
               SET status='QUEUED', attempts=0, next_attempt_at=?, completed_at=NULL,
                   started_at=NULL, error_code='', error_message=''
               WHERE id=? AND status IN ('COMPLETED','FAILED','DEAD_LETTER','QUEUED','CANCELLED')""",
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
            self._drop_prior_snapshots(snap.get("scan_id") or "")
            self.db.execute(
                """INSERT INTO bom_snapshots (id, organization_id, project_id, application_id,
                   scan_id, bom_type, application_version, version_strategy,
                   repository_url, repository_branch, commit_sha, commit_author, commit_email,
                   commit_message, scanner_name, scanner_version, bom_format_version,
                   generated_at, raw_metadata)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    snap["id"], snap.get("organization_id") or "", snap.get("project_id") or "",
                    snap.get("application_id") or "", snap.get("scan_id") or "", snap.get("bom_type") or "SBOM",
                    snap.get("application_version") or "", snap.get("version_strategy") or "",
                    snap.get("repository_url") or "", snap.get("repository_branch") or "",
                    snap.get("commit_sha") or "", snap.get("commit_author") or "", snap.get("commit_email") or "",
                    snap.get("commit_message") or "", snap.get("scanner_name") or "", snap.get("scanner_version") or "",
                    snap.get("bom_format_version") or "", iso(snap.get("generated_at")) or iso(utcnow()),
                    json.dumps(snap.get("raw_metadata") or {}),
                ),
            )
            now = iso(utcnow())
            known = self._known_package_keys(snap.get("organization_id") or "")
            kept: list[dict[str, Any]] = []
            discovered = snap.get("components") or []
            for comp in discovered:
                key = _package_key(comp)
                if key in known:
                    continue
                known.add(key)
                kept.append(comp)
                self.db.execute(
                    """INSERT INTO bom_components (id, bom_snapshot_id, name, version, ecosystem,
                       package_manager, purl, cpe, hash, license, supplier, scope, direct_dependency,
                       source_manifest, raw, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        comp["id"], snap["id"], comp.get("name") or "", comp.get("version") or "",
                        comp.get("ecosystem") or "", comp.get("package_manager") or "", comp.get("purl") or "",
                        comp.get("cpe") or "", comp.get("hash") or "", comp.get("license") or "",
                        comp.get("supplier") or "", comp.get("scope") or "runtime", bool(comp.get("direct")),
                        comp.get("source_manifest") or "", json.dumps(comp.get("raw") or {}), now,
                    ),
                )
            kept_ids = {comp["id"] for comp in kept}
            kept_deps = [
                dep for dep in (snap.get("dependencies") or [])
                if dep.get("from_component_id") in kept_ids and dep.get("to_component_id") in kept_ids
            ]
            for dep in kept_deps:
                self.db.execute(
                    "INSERT INTO bom_dependencies (id, bom_snapshot_id, from_component_id, to_component_id, kind) VALUES (?,?,?,?,?)",
                    (dep["id"], snap["id"], dep["from_component_id"], dep["to_component_id"], dep.get("kind") or "runtime"),
                )
            snap["components"] = kept
            snap["dependencies"] = kept_deps
            snap["components_skipped"] = len(discovered) - len(kept)
            self.db.commit()
        except Exception:
            if self.db.in_transaction:
                self.db.rollback()
            raise

    def _drop_prior_snapshots(self, scan_id: str) -> None:
        if not scan_id:
            return
        rows = self.db.execute("SELECT id FROM bom_snapshots WHERE scan_id = ?", (scan_id,)).fetchall()
        for row in rows:
            snapshot_id = row[0]
            self.db.execute("DELETE FROM exports WHERE snapshot_id = ?", (snapshot_id,))
            self.db.execute("DELETE FROM bom_dependencies WHERE bom_snapshot_id = ?", (snapshot_id,))
            self.db.execute("DELETE FROM bom_components WHERE bom_snapshot_id = ?", (snapshot_id,))
            self.db.execute("DELETE FROM bom_snapshots WHERE id = ?", (snapshot_id,))

    def _known_package_keys(self, organization_id: str) -> set[tuple[str, str, str]]:
        rows = self.db.execute(
            """SELECT lower(c.name), c.version, lower(c.ecosystem)
               FROM bom_components c
               JOIN bom_snapshots s ON s.id = c.bom_snapshot_id
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
                      generated_at, raw_metadata
               FROM bom_snapshots WHERE id = ?""",
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
        return snap

    def _components(self, snapshot_id: str) -> list[dict[str, Any]]:
        rows = self.db.execute(
            """SELECT id, bom_snapshot_id, name, version, ecosystem, package_manager, purl,
                      cpe, hash, license, supplier, scope, direct_dependency, source_manifest, raw
               FROM bom_components WHERE bom_snapshot_id = ? ORDER BY ecosystem, name, version""",
            (snapshot_id,),
        ).fetchall()
        out = []
        for row in rows:
            raw = json.loads(row["raw"]) if row["raw"] else {}
            item = {
                "id": row["id"],
                "bom_snapshot_id": row["bom_snapshot_id"],
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
            if raw:
                item["raw"] = raw
            out.append(item)
        return out

    def _deps(self, snapshot_id: str) -> list[dict[str, Any]]:
        rows = self.db.execute(
            "SELECT id, bom_snapshot_id, from_component_id, to_component_id, kind FROM bom_dependencies WHERE bom_snapshot_id = ?",
            (snapshot_id,),
        ).fetchall()
        return [dict(row) for row in rows]

    def list_for_application(self, app_id: str, limit: int = 50) -> list[dict[str, Any]]:
        if limit <= 0 or limit > 500:
            limit = 100
        rows = self.db.execute(
            "SELECT id FROM bom_snapshots WHERE application_id = ? ORDER BY generated_at DESC LIMIT ?",
            (app_id, limit),
        ).fetchall()
        return [snap for row in rows if (snap := self.get_snapshot(row["id"]))]
