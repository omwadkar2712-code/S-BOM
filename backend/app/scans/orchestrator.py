"""Create a scan row, then run the pipeline when a worker claims the job."""

from __future__ import annotations

import hashlib
import json
import math
import uuid
from datetime import timedelta

from app.scanner import pipeline as scanner
from app.core.config import Config
from app.credentials.service import Audit, Credentials
from app.core.metrics import METRICS
from app.repositories.store import BomRepo, JobQueue, ScanRepo, iso, utcnow
from app.security.archives import ExtractLimits
from app.sources.workspace import prepare_github, prepare_local
from app.storage.object_store import LocalStore
from app.vulnerabilities.provider import VulnProvider


class RetryableError(Exception):
    pass


class TerminalError(Exception):
    pass


class RescanError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class CancelError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class ScanCancelled(Exception):
    pass


class Orchestrator:
    def __init__(self, cfg: Config, scans: ScanRepo, boms: BomRepo, queue: JobQueue, store: LocalStore, creds: Credentials, audit: Audit, vulns: VulnProvider) -> None:
        self.cfg = cfg
        self.scans = scans
        self.boms = boms
        self.queue = queue
        self.store = store
        self.creds = creds
        self.audit = audit
        self.vulns = vulns
        self.limits = ExtractLimits(
            cfg.max_archive_uncompressed,
            cfg.max_archive_entry_bytes,
            cfg.max_files_per_archive,
            cfg.archive_max_compression_ratio,
        )

    def create_scan(self, data: dict) -> dict:
        bom_type = data.get("bom_type") or "SBOM"
        source_type = data["source_type"]
        if bom_type != "SBOM":
            raise RuntimeError(f"unsupported bom_type: {bom_type}")
        if source_type not in ("LOCAL", "GITHUB"):
            raise RuntimeError(f"unsupported source_type: {source_type}")
        key = data.get("idempotency_key") or idempotency_key(data, self.cfg.scanner_name, self.cfg.scanner_version)
        existing = self.scans.find_by_key(key)
        if existing:
            if existing["status"] in ("FAILED", "DEAD_LETTER", "CANCELLED"):
                self.scans.reopen(existing["id"])
                self.queue.requeue_failed(key)
                note = "retrying cancelled scan" if existing["status"] == "CANCELLED" else "retrying failed scan"
                self.scans.record_event(existing["id"], "QUEUED", note)
                existing["status"] = "QUEUED"
                existing["stage"] = "QUEUED"
                existing["error_code"] = ""
                existing["error_message"] = ""
                existing["outcome"] = "reopened"
            else:
                existing["outcome"] = "existing"
            return existing
        now = utcnow()
        scan = {
            "id": str(uuid.uuid4()),
            "organization_id": data["organization_id"],
            "project_id": data.get("project_id") or "",
            "application_id": data.get("application_id") or "",
            "application_name": data.get("application_name") or "",
            "application_version": data.get("application_version") or "UNKNOWN",
            "version_strategy": data.get("version_strategy") or "VERSION_MANUAL",
            "bom_type": bom_type,
            "source_type": source_type,
            "status": "PENDING",
            "stage": "QUEUED",
            "idempotency_key": key,
            "created_at": now,
            "bulk_scan_id": data.get("bulk_scan_id") or "",
            "bulk_row": data.get("bulk_row") or 0,
        }
        self.scans.create_scan(scan)
        self.queue.enqueue(
            {
                "id": str(uuid.uuid4()),
                "scan_id": scan["id"],
                "organization_id": scan["organization_id"],
                "bom_type": bom_type,
                "source_type": source_type,
                "payload": data["source_payload"],
                "created_at": now,
                "next_attempt_at": now,
                "idempotency_key": key,
            }
        )
        self.audit.record("SCAN_CREATED", organization_id=scan["organization_id"], scan_id=scan["id"])
        scan["outcome"] = "created"
        return scan

    def rescan(self, scan: dict) -> dict:
        if scan["status"] not in ("COMPLETED", "FAILED", "DEAD_LETTER", "CANCELLED"):
            raise RescanError("SCAN_NOT_RESCANNABLE", "only completed or failed scans can be rescanned")
        job = self.queue.get_for_scan(scan["id"])
        if job is None:
            raise RescanError("SOURCE_UNAVAILABLE", "the original source for this scan is no longer available")
        if job["status"] == "RUNNING":
            raise RescanError("SCAN_NOT_RESCANNABLE", "this scan is still running")
        self.scans.reset_for_rescan(scan["id"])
        self.queue.requeue(job["id"])
        self.scans.record_event(scan["id"], "QUEUED", "rescan requested")
        self.audit.record("SCAN_RESCANNED", organization_id=scan["organization_id"], scan_id=scan["id"])
        updated = dict(scan)
        updated["status"] = "QUEUED"
        updated["stage"] = "QUEUED"
        updated["error_code"] = ""
        updated["error_message"] = ""
        updated["completed_at"] = None
        updated["started_at"] = None
        updated["snapshot_id"] = ""
        return updated

    def cancel(self, scan: dict) -> dict:
        status = (scan.get("status") or "").upper()
        if status in ("COMPLETED", "FAILED", "DEAD_LETTER", "CANCELLED"):
            raise CancelError("SCAN_NOT_CANCELLABLE", "This scan has already finished.")
        # PENDING and QUEUED have not started. RUNNING has. A missing or
        # already-finished job row must not block either case.
        job = self.queue.get_for_scan(scan["id"])
        self.scans.mark_cancelled(scan["id"])
        if job is not None:
            self.queue.mark_cancelled(job["id"])
        current = self.scans.get_scan(scan["id"])
        if current is None or current["status"] != "CANCELLED":
            raise CancelError("SCAN_NOT_CANCELLABLE", "This scan has already finished.")
        self.scans.record_event(scan["id"], "CANCELLED", "cancelled by user")
        self.audit.record("SCAN_CANCELLED", organization_id=scan["organization_id"], scan_id=scan["id"])
        updated = dict(scan)
        updated["status"] = "CANCELLED"
        updated["stage"] = "CANCELLED"
        updated["error_code"] = "CANCELLED"
        updated["error_message"] = "Cancelled by user"
        return updated

    def execute(self, job: dict) -> None:
        scan = self.scans.get_scan(job["scan_id"])
        if scan is None:
            raise TerminalError("scan missing")
        if scan["status"] == "CANCELLED":
            raise ScanCancelled("scan cancelled")
        self.scans.mark_running(scan["id"])
        try:
            self._stage(scan["id"], "VALIDATING", "starting scan")
            self._stage(scan["id"], "EXTRACTING", "preparing workspace")
            if job["source_type"] == "LOCAL":
                workspace = prepare_local(self.store, "uploads", job["payload"], self.limits, None)
            elif job["source_type"] == "GITHUB":
                workspace = prepare_github(
                    job["payload"],
                    self.cfg.github_api_url,
                    self.cfg.github_timeout_seconds,
                    self.limits,
                    self.cfg.max_archive_uncompressed,
                    self.creds,
                    None,
                )
            else:
                raise TerminalError("unsupported source")
            try:
                self._stage(scan["id"], "DETECTING_MANIFESTS", "scanning workspace")
                snap = scanner.scan_tree(str(workspace.root), self.cfg.scanner_version)
                meta = workspace.metadata
                snap.update(
                    {
                        "organization_id": scan["organization_id"],
                        "project_id": scan["project_id"],
                        "application_id": scan["application_id"],
                        "scan_id": scan["id"],
                        "bom_type": scan["bom_type"],
                        "application_version": scan["application_version"],
                        "version_strategy": scan["version_strategy"],
                        "repository_url": meta.get("repository_url") or "",
                        "repository_branch": meta.get("repository_branch") or "",
                        "commit_sha": meta.get("commit_sha") or "",
                        "commit_author": meta.get("commit_author") or "",
                        "commit_email": meta.get("commit_email") or "",
                        "commit_message": meta.get("commit_message") or "",
                        "scanner_name": self.cfg.scanner_name,
                        "scanner_version": self.cfg.scanner_version,
                    }
                )
                self._stage(scan["id"], "NORMALIZING", "normalising components")
                scanner.normalize(snap)
                self._stage(scan["id"], "ANALYZING_VULNERABILITIES", "correlating vulnerabilities")
                try:
                    self.vulns.correlate(snap)
                except Exception as exc:
                    self._stage(scan["id"], "ANALYZING_VULNERABILITIES", "vulnerability correlation failed: " + str(exc))
                self._stage(scan["id"], "GENERATING_SBOM", "persisting snapshot")
                try:
                    self.boms.save_snapshot(snap)
                except Exception as exc:
                    raise RetryableError(str(exc)) from exc
            finally:
                workspace.cleanup()
        except ScanCancelled:
            raise
        except RetryableError:
            self._fail(scan, "PERSIST_FAILED", "could not persist snapshot", retryable=True)
            raise
        except Exception as exc:
            code = "SOURCE_PREPARE_FAILED" if "workspace" not in locals() else "SCANNER_FAILED"
            if isinstance(exc, TerminalError):
                code = "UNSUPPORTED_SOURCE"
            self._fail(scan, code, str(exc), retryable=False)
            raise TerminalError(str(exc)) from exc
        self._ensure_active(scan["id"])
        self.scans.mark_completed(scan["id"], snap["id"])
        if self.scans.get_scan(scan["id"])["status"] == "CANCELLED":
            raise ScanCancelled("scan cancelled")
        added = len(snap.get("components") or [])
        skipped = int(snap.get("components_skipped") or 0)
        self._stage(scan["id"], "COMPLETED", f"scan complete, added {added}, skipped {skipped} existing versions")
        self.audit.record(
            "SCAN_COMPLETED",
            organization_id=scan["organization_id"],
            scan_id=scan["id"],
            metadata={"components": len(snap.get("components") or [])},
        )
        METRICS.add("components_discovered", len(snap.get("components") or []))

    def _ensure_active(self, scan_id: str) -> None:
        current = self.scans.get_scan(scan_id)
        if current is None or current["status"] == "CANCELLED":
            raise ScanCancelled("scan cancelled")

    def _stage(self, scan_id: str, stage: str, message: str) -> None:
        self._ensure_active(scan_id)
        self.scans.record_event(scan_id, stage, message)
        self.scans.set_stage(scan_id, stage)

    def _fail(self, scan: dict, code: str, message: str, retryable: bool) -> None:
        self._ensure_active(scan["id"])
        self._stage(scan["id"], "FAILED", f"{code}: {message}")
        self.scans.mark_failed(scan["id"], code, message)
        self.audit.record("SCAN_FAILED", organization_id=scan["organization_id"], scan_id=scan["id"], metadata={"code": code, "message": message})


def idempotency_key(data: dict, scanner_name: str, scanner_version: str) -> str:
    payload = data.get("source_payload") or {}
    parts = [
        data.get("organization_id") or "",
        data.get("application_id") or "",
        data.get("bom_type") or "SBOM",
        data.get("source_type") or "",
        str(payload.get("repository_url") or ""),
        str(payload.get("branch") or ""),
        str(payload.get("commit_sha") or ""),
        str(payload.get("upload_hash") or ""),
        scanner_name,
        scanner_version,
        "",
    ]
    digest = hashlib.sha256()
    digest.update("|".join(parts).encode())
    # Go writes a pipe between fields and does not add one after the last field.
    # "|".join matches that.
    return digest.hexdigest()


def backoff_seconds(attempts: int) -> int:
    if attempts == 1:
        return 5
    if attempts == 2:
        return 30
    delay = int(math.pow(2, attempts))
    return min(delay, 15 * 60)


def next_attempt(attempts: int):
    return utcnow() + timedelta(seconds=backoff_seconds(attempts))


def stable_config_digest(config: dict | None) -> str:
    if not config:
        return ""
    keys = sorted(config)
    return json.dumps({"keys": keys, "data": config}, separators=(",", ":"))
