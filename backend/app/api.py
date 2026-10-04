"""HTTP API. Responses use the same JSON envelope the UI already expects."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from typing import Any

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, Response

from .config import Config, load
from .credentials import Audit, CredentialStore, Credentials
from .db import connect, migrate
from .export import EXPORTERS, export_snapshot
from .metrics import METRICS
from .orchestrator import CancelError, Orchestrator, RescanError
from .repos import BomRepo, JobQueue, ScanRepo, iso, public_scan, utcnow
from .sources import is_supported_manifest, pack_folder, parse_bulk, safe_upload_rel, validate_repo_url
from .storage import open_store
from .vuln import VulnProvider

log = logging.getLogger("bom")


def _envelope(data: Any, request_id: str, status: int = 200) -> JSONResponse:
    body: dict[str, Any] = {"success": True, "request_id": request_id}
    if data is not None:
        body["data"] = data
    return JSONResponse(body, status_code=status)


def _error(code: str, message: str, request_id: str, status: int) -> JSONResponse:
    return JSONResponse(
        {"success": False, "error": {"code": code, "message": message}, "request_id": request_id},
        status_code=status,
    )


def _org(request: Request) -> str:
    return (request.headers.get("x-organization-id") or "default").strip() or "default"


def _with_sources(queue: JobQueue, rows: list[dict]) -> list[dict]:
    labels = queue.source_labels([row["id"] for row in rows])
    decorated = []
    for row in rows:
        item = dict(row)
        item.update(labels.get(row["id"]) or {})
        decorated.append(item)
    return decorated


def build(cfg: Config | None = None) -> FastAPI:
    cfg = cfg or load()
    db = connect(cfg)
    migrate(db)
    store = open_store(cfg)
    secrets = CredentialStore(db, cfg.credential_kek)
    creds = Credentials(db, secrets)
    audit = Audit(db)
    scans = ScanRepo(db)
    boms = BomRepo(db)
    queue = JobQueue(db)
    vulns = VulnProvider(cfg.vuln_provider, cfg.vuln_timeout_seconds, cfg.mitre_api_url)
    orch = Orchestrator(cfg, scans, boms, queue, store, creds, audit, vulns)

    app = FastAPI(title="BOM Engine", docs_url=None, redoc_url=None)
    app.state.cfg = cfg
    app.state.orch = orch
    app.state.scans = scans
    app.state.boms = boms
    app.state.creds = creds
    app.state.audit = audit
    app.state.store = store
    app.state.db = db
    if cfg.api_allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cfg.api_allow_origins,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type", "Authorization", "X-Organization-Id", "X-User-Id", "X-Request-Id"],
            max_age=600,
        )

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-Id"] = rid
        return response

    def rid(request: Request) -> str:
        return getattr(request.state, "request_id", "")

    @app.get("/health/live")
    def live(request: Request):
        return _envelope({"status": "live"}, rid(request))

    @app.get("/health/ready")
    def ready(request: Request):
        return _envelope(
            {
                "status": "ready",
                "database": cfg.dialect,
                "metrics": METRICS.snapshot(),
                "scanner": {"name": cfg.scanner_name, "version": cfg.scanner_version},
                "exporters": list(EXPORTERS),
            },
            rid(request),
        )

    @app.get("/metrics.json")
    def metrics(request: Request):
        return _envelope(METRICS.snapshot(), rid(request))

    @app.post("/api/v1/scans/local")
    async def local_scan(
        request: Request,
        file: UploadFile | None = File(default=None),
        files: list[UploadFile] | None = File(default=None),
        paths: list[str] | None = Form(default=None),
        project_name: str = Form(default=""),
        application_name: str = Form(default=""),
        version: str = Form(default=""),
    ):
        length = request.headers.get("content-length")
        if length and int(length) > cfg.max_upload_bytes:
            return _error("INVALID_INPUT", "multipart parse failed", rid(request), 400)
        try:
            if files:
                pairs = []
                path_list = paths or []
                if path_list and len(path_list) != len(files):
                    return _error("INVALID_INPUT", "folder path is not allowed", rid(request), 400)
                for index, upload in enumerate(files):
                    name = path_list[index] if path_list else (upload.filename or "")
                    content = await upload.read()
                    if len(content) > cfg.max_upload_bytes:
                        return _error("INVALID_INPUT", "multipart parse failed", rid(request), 400)
                    pairs.append((name, content))
                try:
                    packed, upload_name = pack_folder(pairs)
                except ValueError:
                    return _error("INVALID_INPUT", "folder path is not allowed", rid(request), 400)
                except LookupError:
                    return _error(
                        "UNSUPPORTED_FILE",
                        "folder must contain a supported manifest such as package.json, requirements.txt, pom.xml, go.mod, Cargo.toml, composer.json, or Gemfile",
                        rid(request),
                        400,
                    )
                blob = packed
            elif file is not None and file.filename:
                filename = file.filename
                lower = filename.lower()
                archive = lower.endswith(".zip") or lower.endswith(".tgz") or lower.endswith(".tar.gz")
                if not archive and not is_supported_manifest(filename):
                    return _error(
                        "UNSUPPORTED_FILE",
                        "file must be a .zip/.tar.gz archive, a supported manifest, or a project folder",
                        rid(request),
                        400,
                    )
                blob = await file.read()
                upload_name = filename
            else:
                return _error("INVALID_INPUT", "file field is required", rid(request), 400)
        except Exception:
            log.exception("local upload failed")
            return _error("INVALID_INPUT", "multipart parse failed", rid(request), 400)
        if not application_name:
            return _error("INVALID_INPUT", "application_name is required", rid(request), 400)
        org = _org(request)
        key = f"uploads/{org}/{uuid.uuid4()}-{_safe_name(upload_name)}"
        from io import BytesIO

        store.put("uploads", key, BytesIO(blob))
        strategy = "VERSION_MANUAL"
        app_version = version
        if not app_version:
            strategy = "VERSION_UNKNOWN"
            app_version = "UNKNOWN"
        try:
            scan = orch.create_scan(
                {
                    "organization_id": org,
                    "project_id": project_name,
                    "application_id": application_name,
                    "application_name": application_name,
                    "application_version": app_version,
                    "version_strategy": strategy,
                    "bom_type": "SBOM",
                    "source_type": "LOCAL",
                    "source_payload": {
                        "object_key": key,
                        "file_name": upload_name,
                        "upload_hash": hashlib.sha256(blob).hexdigest(),
                    },
                }
            )
        except Exception as exc:
            return _error("CREATE_SCAN_FAILED", str(exc), rid(request), 400)
        return _envelope({"scan_id": scan["id"], "status": scan["status"], "stage": scan["stage"]}, rid(request), 202)

    @app.post("/api/v1/scans/github")
    async def github_scan(request: Request):
        try:
            body = await request.json()
        except Exception:
            return _error("INVALID_INPUT", "malformed JSON body", rid(request), 400)
        try:
            validate_repo_url(body.get("repository_url") or "")
        except ValueError as exc:
            return _error("INVALID_REPOSITORY", str(exc), rid(request), 400)
        if not body.get("application_name"):
            return _error("INVALID_INPUT", "application_name is required", rid(request), 400)
        org = _org(request)
        version = body.get("version") or ""
        strategy = "VERSION_MANUAL"
        if not version:
            strategy = "VERSION_UNKNOWN"
            version = "UNKNOWN"
        auth = body.get("authentication") or {}
        try:
            scan = orch.create_scan(
                {
                    "organization_id": org,
                    "project_id": body.get("project_name") or "",
                    "application_id": body.get("application_name"),
                    "application_name": body.get("application_name"),
                    "application_version": version,
                    "version_strategy": strategy,
                    "bom_type": "SBOM",
                    "source_type": "GITHUB",
                    "source_payload": {
                        "repository_url": body.get("repository_url"),
                        "branch": body.get("branch") or "",
                        "commit_sha": body.get("commit_sha") or "",
                        "credential_id": auth.get("credential_id") or "",
                        "organization_id": org,
                    },
                }
            )
        except Exception as exc:
            return _error("CREATE_SCAN_FAILED", str(exc), rid(request), 400)
        return _envelope({"scan_id": scan["id"], "status": scan["status"], "stage": scan.get("stage") or "QUEUED"}, rid(request), 202)

    @app.get("/api/v1/scans")
    def list_scans(request: Request):
        rows = _with_sources(queue, scans.list_scans(_org(request), 100))
        return _envelope([public_scan(row) for row in rows], rid(request))

    @app.get("/api/v1/scans/{scan_id}")
    def get_scan(scan_id: str, request: Request):
        scan = _owned(scans, scan_id, _org(request))
        if scan is None:
            return _error("SCAN_NOT_FOUND", "the requested scan does not exist", rid(request), 404)
        return _envelope(public_scan(_with_sources(queue, [scan])[0]), rid(request))

    @app.get("/api/v1/scans/{scan_id}/status")
    def scan_status(scan_id: str, request: Request):
        scan = _owned(scans, scan_id, _org(request))
        if scan is None:
            return _error("SCAN_NOT_FOUND", "not found", rid(request), 404)
        labels = queue.source_labels([scan["id"]]).get(scan["id"]) or {}
        data = {"scan_id": scan["id"], "status": scan["status"], "stage": scan["stage"]}
        if scan.get("error_code"):
            data["error_code"] = scan["error_code"]
        if scan.get("error_message"):
            data["error_message"] = scan["error_message"]
        if scan.get("started_at"):
            data["started_at"] = scan["started_at"]
        if scan.get("completed_at"):
            data["completed_at"] = scan["completed_at"]
        if scan.get("source_type"):
            data["source_type"] = scan["source_type"]
        for key in ("file_name", "repository_url", "branch"):
            if labels.get(key):
                data[key] = labels[key]
        return _envelope(data, rid(request))

    @app.post("/api/v1/scans/{scan_id}/rescan")
    def rescan(scan_id: str, request: Request):
        scan = _owned(scans, scan_id, _org(request))
        if scan is None:
            return _error("SCAN_NOT_FOUND", "the requested scan does not exist", rid(request), 404)
        try:
            updated = orch.rescan(scan)
        except RescanError as exc:
            status = 409 if exc.code == "SCAN_NOT_RESCANNABLE" else 400
            return _error(exc.code, str(exc), rid(request), status)
        db.execute(
            """UPDATE bulk_scan_items
               SET status='QUEUED', error_code=NULL, error_message=NULL, started_at=NULL, completed_at=NULL
               WHERE scan_id=?""",
            (scan_id,),
        )
        return _envelope(
            {"scan_id": updated["id"], "status": updated["status"], "stage": updated["stage"]},
            rid(request),
            202,
        )

    @app.post("/api/v1/scans/{scan_id}/cancel")
    def cancel_scan(scan_id: str, request: Request):
        scan = _owned(scans, scan_id, _org(request))
        if scan is None:
            return _error("SCAN_NOT_FOUND", "the requested scan does not exist", rid(request), 404)
        try:
            updated = orch.cancel(scan)
        except CancelError as exc:
            return _error(exc.code, str(exc), rid(request), 409)
        db.execute(
            """UPDATE bulk_scan_items
               SET status='CANCELLED', error_code='CANCELLED', error_message='Cancelled by user', completed_at=CURRENT_TIMESTAMP
               WHERE scan_id=? AND status IN ('QUEUED','RUNNING','PENDING')""",
            (scan_id,),
        )
        return _envelope(
            {"scan_id": updated["id"], "status": updated["status"], "stage": updated["stage"]},
            rid(request),
            202,
        )

    @app.get("/api/v1/scans/{scan_id}/events")
    def scan_events(scan_id: str, request: Request):
        return _envelope(scans.list_events(scan_id), rid(request))

    @app.get("/api/v1/scans/{scan_id}/sbom")
    def scan_sbom(scan_id: str, request: Request):
        scan = _owned(scans, scan_id, _org(request))
        if scan is None:
            return _error("SCAN_NOT_FOUND", "not found", rid(request), 404)
        if not scan.get("snapshot_id"):
            return _error("SBOM_NOT_READY", "sbom not ready yet", rid(request), 404)
        snap = boms.get_snapshot(scan["snapshot_id"])
        if snap is None:
            return _error("BOM_NOT_FOUND", "not found", rid(request), 404)
        return _envelope(snap, rid(request))

    @app.get("/api/v1/scans/{scan_id}/components")
    def scan_components(scan_id: str, request: Request):
        snap, err = _snap_for_scan(scans, boms, scan_id, _org(request), rid(request))
        if err:
            return err
        return _envelope(snap["components"], rid(request))

    @app.get("/api/v1/scans/{scan_id}/dependencies")
    def scan_deps(scan_id: str, request: Request):
        snap, err = _snap_for_scan(scans, boms, scan_id, _org(request), rid(request))
        if err:
            return err
        return _envelope(snap["dependencies"], rid(request))

    @app.get("/api/v1/scans/{scan_id}/vulnerabilities")
    def scan_vulns(scan_id: str, request: Request):
        snap, err = _snap_for_scan(scans, boms, scan_id, _org(request), rid(request))
        if err:
            return err
        return _envelope((snap.get("raw_metadata") or {}).get("vulnerability_matches"), rid(request))

    @app.get("/api/v1/scans/{scan_id}/export")
    def scan_export(scan_id: str, request: Request):
        scan = _owned(scans, scan_id, _org(request))
        if scan is None or not scan.get("snapshot_id"):
            return _error("SCAN_NOT_FOUND", "not found", rid(request), 404)
        query = request.url.query
        return RedirectResponse(f"/api/v1/boms/{scan['snapshot_id']}/export?{query}", status_code=302)

    @app.get("/api/v1/boms/{bom_id}")
    def get_bom(bom_id: str, request: Request):
        snap = boms.get_snapshot(bom_id)
        if snap is None or snap.get("organization_id") != _org(request):
            return _error("BOM_NOT_FOUND", "not found", rid(request), 404)
        return _envelope(snap, rid(request))

    @app.get("/api/v1/boms/{bom_id}/export")
    def export_bom(bom_id: str, request: Request, format: str = "cyclonedx-json"):
        snap = boms.get_snapshot(bom_id)
        if snap is None or snap.get("organization_id") != _org(request):
            return _error("BOM_NOT_FOUND", "not found", rid(request), 404)
        try:
            payload, content_type = export_snapshot(format, snap)
        except KeyError:
            return _error("UNSUPPORTED_FORMAT", "unsupported format", rid(request), 400)
        return Response(payload, media_type=content_type)

    @app.get("/api/v1/applications/{application_id}/boms")
    def app_boms(application_id: str, request: Request):
        org = _org(request)
        snaps = [snap for snap in boms.list_for_application(application_id, 50) if snap.get("organization_id") == org]
        return _envelope(snaps, rid(request))

    @app.post("/api/v1/scans/bulk")
    async def bulk_upload(request: Request, file: UploadFile | None = File(default=None), project_name: str = Form(default="")):
        if file is None or not file.filename:
            return _error("INVALID_INPUT", "file field is required", rid(request), 400)
        lower = file.filename.lower()
        if not (lower.endswith(".csv") or lower.endswith(".xlsx")):
            return _error("UNSUPPORTED_FILE", "expected .csv or .xlsx", rid(request), 400)
        blob = await file.read()
        if len(blob) > cfg.max_bulk_file_bytes:
            return _error("INVALID_INPUT", "multipart parse failed", rid(request), 400)
        try:
            rows, errors = parse_bulk(file.filename, blob, cfg.max_bulk_file_bytes)
        except Exception as exc:
            return _error("INVALID_BULK_FILE", str(exc), rid(request), 400)
        if len(rows) > cfg.max_bulk_rows:
            return _error("TOO_MANY_ROWS", "file exceeds MAX_BULK_ROWS", rid(request), 400)
        try:
            aggregate = _submit_bulk(db, orch, _org(request), project_name, file.filename, rows, errors)
        except Exception as exc:
            return _error("SUBMIT_FAILED", str(exc), rid(request), 500)
        return _envelope(aggregate, rid(request), 202)

    @app.get("/api/v1/bulk-scans/{bulk_id}")
    def get_bulk(bulk_id: str, request: Request):
        agg = _get_bulk(db, bulk_id, _org(request))
        if agg is None:
            return _error("BULK_NOT_FOUND", "not found", rid(request), 404)
        return _envelope(agg, rid(request))

    @app.get("/api/v1/bulk-scans/{bulk_id}/results")
    def bulk_results(bulk_id: str, request: Request):
        agg = _get_bulk(db, bulk_id, _org(request))
        if agg is None:
            return _error("BULK_NOT_FOUND", "not found", rid(request), 404)
        return _envelope(agg["items"], rid(request))

    @app.post("/api/v1/credentials/github")
    async def create_cred(request: Request):
        try:
            body = await request.json()
        except Exception:
            return _error("INVALID_INPUT", "malformed JSON body", rid(request), 400)
        org = _org(request)
        kind = body.get("type")
        try:
            if kind == "GITHUB_APP":
                if not body.get("app_id") or not body.get("private_key_pem"):
                    return _error("INVALID_INPUT", "app_id and private_key_pem are required", rid(request), 400)
                cred = creds.create_app(org, body.get("name") or "", body["app_id"], body["private_key_pem"], body.get("repository_scope"))
            elif kind == "GITHUB_FINE_GRAINED_PAT":
                if not body.get("token"):
                    return _error("INVALID_INPUT", "token is required", rid(request), 400)
                cred = creds.create_pat(org, body.get("name") or "", body["token"], body.get("repository_scope"))
            else:
                return _error("INVALID_INPUT", "unsupported credential type", rid(request), 400)
        except Exception:
            log.exception("credential store failed")
            return _error("CREDENTIAL_FAILED", "failed to store credential", rid(request), 500)
        audit.record("CREDENTIAL_CREATED", organization_id=org, credential_id=cred["id"], metadata={"type": cred["credential_type"]})
        return _envelope(cred, rid(request), 201)

    @app.get("/api/v1/credentials/github")
    def list_creds(request: Request):
        return _envelope(creds.list(_org(request)), rid(request))

    @app.delete("/api/v1/credentials/github/{cred_id}")
    def revoke_cred(cred_id: str, request: Request):
        org = _org(request)
        try:
            creds.revoke(cred_id, org)
        except LookupError:
            return _error("CREDENTIAL_NOT_FOUND", "not found", rid(request), 404)
        audit.record("CREDENTIAL_REVOKED", organization_id=org, credential_id=cred_id)
        return _envelope({"status": "revoked"}, rid(request))

    @app.post("/api/v1/github/webhooks")
    async def webhook(request: Request):
        body = await request.body()
        if len(body) > 5 * 1024 * 1024:
            return _error("INVALID_INPUT", "unreadable body", rid(request), 400)
        if not _valid_signature(request.headers.get("x-hub-signature-256") or "", body, cfg.github_webhook_secret.encode()):
            return _error("SIGNATURE_INVALID", "signature invalid", rid(request), 401)
        event = request.headers.get("x-github-event") or ""
        delivery = request.headers.get("x-github-delivery") or ""
        if not delivery:
            return _error("INVALID_INPUT", "missing delivery id", rid(request), 400)
        try:
            db.execute(
                "INSERT INTO webhook_events (id, provider, event_type, delivery_id, received_at, processed) VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), "github", event, delivery, iso(utcnow()), False),
            )
        except Exception:
            return _envelope({"status": "duplicate"}, rid(request))
        audit.record("WEBHOOK_RECEIVED", metadata={"event": event, "delivery": delivery})
        if event not in ("push", "release"):
            return _envelope({"status": "ignored"}, rid(request))
        try:
            payload = json.loads(body)
        except Exception:
            return _error("INVALID_INPUT", "malformed payload", rid(request), 400)
        full_name = ((payload.get("repository") or {}).get("full_name") or "")
        url = "https://github.com/" + full_name
        try:
            validate_repo_url(url)
        except ValueError as exc:
            return _error("INVALID_REPOSITORY", str(exc), rid(request), 400)
        ref = payload.get("ref") or ""
        branch = (payload.get("repository") or {}).get("default_branch") or ""
        if ref.startswith("refs/heads/"):
            branch = ref[len("refs/heads/") :]
        after = payload.get("after") or ""
        org = _org(request)
        try:
            scan = orch.create_scan(
                {
                    "organization_id": org,
                    "project_id": full_name,
                    "application_id": full_name,
                    "application_name": full_name,
                    "application_version": "webhook-" + after[:7],
                    "version_strategy": "VERSION_UNKNOWN",
                    "bom_type": "SBOM",
                    "source_type": "GITHUB",
                    "source_payload": {
                        "repository_url": url,
                        "branch": branch,
                        "commit_sha": after,
                        "organization_id": org,
                    },
                }
            )
        except Exception as exc:
            return _error("SCAN_CREATE_FAILED", str(exc), rid(request), 500)
        return _envelope({"status": "queued", "scan_id": scan["id"]}, rid(request))

    return app


def _safe_name(name: str) -> str:
    base = name.replace("\\", "/").split("/")[-1]
    return base.replace("..", "")


def _owned(scans: ScanRepo, scan_id: str, org: str):
    scan = scans.get_scan(scan_id)
    if scan is None or scan["organization_id"] != org:
        return None
    return scan


def _snap_for_scan(scans, boms, scan_id, org, request_id):
    scan = _owned(scans, scan_id, org)
    if scan is None or not scan.get("snapshot_id"):
        return None, _error("SCAN_NOT_FOUND", "not found", request_id, 404)
    snap = boms.get_snapshot(scan["snapshot_id"])
    if snap is None:
        return None, _error("BOM_NOT_FOUND", "not found", request_id, 404)
    return snap, None


def _valid_signature(header: str, body: bytes, secret: bytes) -> bool:
    if not secret or not header.startswith("sha256="):
        return False
    digest = hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(header, "sha256=" + digest)


def _row_problems(errors: list) -> dict[int, list]:
    grouped: dict[int, list] = {}
    for err in errors:
        grouped.setdefault(err["row"], []).append(err)
    return grouped


def _submit_bulk(db, orch: Orchestrator, org: str, project: str, filename: str, rows: list, errors: list) -> dict:
    from .repos import iso, utcnow

    bulk_id = str(uuid.uuid4())
    created = iso(utcnow())
    problems = _row_problems(errors)
    db.execute(
        """INSERT INTO bulk_scans (id, organization_id, project_id, status, filename, total_rows, invalid_rows, created_at, validation_errors)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (bulk_id, org, project, "PROCESSING", filename, len(rows), len(problems), created, json.dumps(errors)),
    )
    METRICS.add("bulk_scans_total")
    items = []
    queued = 0
    seen_scans: set[str] = set()
    for row in rows:
        item_id = str(uuid.uuid4())
        scan_id = ""
        error_code = ""
        error_message = ""
        row_problems = problems.get(row["row_number"]) or []
        if row_problems:
            status = "SKIPPED"
            error_code = row_problems[0]["code"]
            error_message = "; ".join(problem["message"] for problem in row_problems)
        else:
            try:
                scan = orch.create_scan(
                    {
                        "organization_id": org,
                        "project_id": row["project_name"] or project,
                        "application_id": row["application_name"],
                        "application_name": row["application_name"],
                        "application_version": row["version"] or "UNKNOWN",
                        "version_strategy": "VERSION_MANUAL",
                        "bom_type": "SBOM",
                        "source_type": "GITHUB",
                        "source_payload": {
                            "repository_url": row["repository_url"],
                            "branch": row["branch"],
                            "credential_id": row["authentication_reference"],
                            "organization_id": org,
                        },
                        "bulk_scan_id": bulk_id,
                        "bulk_row": row["row_number"],
                    }
                )
            except Exception as exc:
                status = "FAILED"
                error_code = "SCAN_CREATE_FAILED"
                error_message = str(exc)
                errors.append({"row": row["row_number"], "field": "repository_url", "code": error_code, "message": error_message})
            else:
                outcome = scan.get("outcome")
                if outcome == "existing" or scan["id"] in seen_scans:
                    status = "SKIPPED"
                    error_code = "DUPLICATE_PROJECT"
                    branch = row["branch"] or "the default branch"
                    error_message = (
                        f"Duplicate project. Scan {scan['id']} already covers {row['repository_url']} ({branch}) "
                        "for this application. That scan was kept and this row was not queued."
                    )
                    errors.append(
                        {
                            "row": row["row_number"],
                            "field": "repository_url",
                            "code": "DUPLICATE_PROJECT",
                            "message": error_message,
                        }
                    )
                else:
                    status = "QUEUED"
                    scan_id = scan["id"]
                    seen_scans.add(scan["id"])
                    queued += 1
        db.execute(
            """INSERT INTO bulk_scan_items
               (id, bulk_scan_id, row_number, scan_id, project_name, application_name, version, repository_url, status, error_code, error_message)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                item_id,
                bulk_id,
                row["row_number"],
                scan_id or None,
                row["project_name"],
                row["application_name"],
                row["version"],
                row["repository_url"],
                status,
                error_code or None,
                error_message or None,
            ),
        )
        payload = {
            "id": item_id,
            "bulk_scan_id": bulk_id,
            "row_number": row["row_number"],
            "project_name": row["project_name"],
            "application_name": row["application_name"],
            "version": row["version"],
            "repository_url": row["repository_url"],
            "status": status,
        }
        if scan_id:
            payload["scan_id"] = scan_id
        if error_code:
            payload["error_code"] = error_code
        if error_message:
            payload["error_message"] = error_message
        items.append(payload)
    invalid_rows = len(rows) - queued
    status = "PROCESSING" if queued else "FAILED"
    db.execute(
        "UPDATE bulk_scans SET status=?, invalid_rows=?, validation_errors=? WHERE id=?",
        (status, invalid_rows, json.dumps(errors), bulk_id),
    )
    return {
        "id": bulk_id,
        "organization_id": org,
        "project_id": project,
        "status": status,
        "filename": filename,
        "total_rows": len(rows),
        "queued_rows": queued,
        "invalid_rows": invalid_rows,
        "created_at": created,
        "validation_errors": errors or None,
        "items": items,
    }


def _get_bulk(db, bulk_id: str, org: str) -> dict | None:
    row = db.execute(
        """SELECT id, organization_id, project_id, status, filename, total_rows, invalid_rows, created_at, completed_at, validation_errors
           FROM bulk_scans WHERE id=? AND organization_id=?""",
        (bulk_id, org),
    ).fetchone()
    if row is None:
        return None
    errors = json.loads(row["validation_errors"]) if row["validation_errors"] else []
    item_rows = db.execute(
        """SELECT bsi.id, bsi.bulk_scan_id, bsi.row_number, COALESCE(bsi.scan_id,''),
                  bsi.project_name, bsi.application_name, bsi.version, bsi.repository_url,
                  CASE WHEN bsi.status = 'SKIPPED' THEN bsi.status ELSE COALESCE(s.status, bsi.status) END,
                  CASE WHEN bsi.status = 'SKIPPED' THEN COALESCE(bsi.error_code, '') ELSE COALESCE(NULLIF(s.error_code, ''), bsi.error_code, '') END,
                  CASE WHEN bsi.status = 'SKIPPED' THEN COALESCE(bsi.error_message, '') ELSE COALESCE(NULLIF(s.error_message, ''), bsi.error_message, '') END,
                  s.started_at, s.completed_at
           FROM bulk_scan_items bsi
           LEFT JOIN scans s ON s.id = bsi.scan_id
           WHERE bsi.bulk_scan_id = ?
           ORDER BY bsi.row_number""",
        (bulk_id,),
    ).fetchall()
    items = []
    for item in item_rows:
        payload = {
            "id": item[0],
            "bulk_scan_id": item[1],
            "row_number": item[2],
            "project_name": item[4],
            "application_name": item[5],
            "version": item[6],
            "repository_url": item[7],
            "status": item[8],
        }
        if item[3]:
            payload["scan_id"] = item[3]
        if item[9]:
            payload["error_code"] = item[9]
        if item[10]:
            payload["error_message"] = item[10]
        if item[11]:
            payload["started_at"] = item[11]
        if item[12]:
            payload["completed_at"] = item[12]
        items.append(payload)
    failed = sum(1 for item in items if item["status"] in ("FAILED", "SKIPPED", "DEAD_LETTER"))
    completed = sum(1 for item in items if item["status"] == "COMPLETED")
    running = sum(1 for item in items if item["status"] in ("RUNNING", "QUEUED", "PENDING"))
    if running:
        status = "PROCESSING"
    elif failed and completed:
        status = "COMPLETED_WITH_ERRORS"
    elif failed and not completed:
        status = "FAILED"
    elif row["invalid_rows"] and not completed:
        status = "FAILED"
    elif not completed:
        status = "PROCESSING"
    else:
        status = "COMPLETED"
    agg = {
        "id": row["id"],
        "organization_id": row["organization_id"],
        "project_id": row["project_id"],
        "status": status,
        "filename": row["filename"],
        "total_rows": row["total_rows"],
        "invalid_rows": row["invalid_rows"],
        "created_at": row["created_at"],
        "items": items,
    }
    if row["completed_at"]:
        agg["completed_at"] = row["completed_at"]
    if errors:
        agg["validation_errors"] = errors
    return agg
