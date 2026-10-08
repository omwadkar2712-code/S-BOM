"""Local upload produces components the UI can read."""

import base64
import io
import json
import os
import zipfile

import psycopg
from fastapi.testclient import TestClient

TEST_DB = "postgresql://sbom:sbom@127.0.0.1:5432/sbom_test"

os.environ["CREDENTIAL_KEK"] = base64.b64encode(b"0123456789abcdef0123456789abcdef").decode()
os.environ["DATABASE_URL"] = TEST_DB
os.environ["OBJECT_STORAGE_URL"] = "local://./data/test-objects"
os.environ["API_ALLOW_ORIGINS"] = "http://127.0.0.1:5173"
os.environ["VULN_PROVIDER"] = "osv"

from app.api import build  # noqa: E402


def _fresh(objects) -> None:
    conn = psycopg.connect(TEST_DB, autocommit=True)
    conn.execute("DROP SCHEMA IF EXISTS public CASCADE")
    conn.execute("CREATE SCHEMA public")
    conn.execute("GRANT ALL ON SCHEMA public TO PUBLIC")
    conn.close()
    os.environ["DATABASE_URL"] = TEST_DB
    os.environ["OBJECT_STORAGE_URL"] = "local://" + objects.as_posix()


def test_local_package_json_scan(tmp_path):
    _fresh(tmp_path / "objects")
    app = build()
    client = TestClient(app)
    ready = client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json()["data"]["status"] == "ready"
    assert ready.json()["data"]["database"] == "postgres"

    manifest = json.dumps({"name": "demo", "version": "1.0.0", "dependencies": {"left-pad": "1.3.0"}}).encode()
    created = client.post(
        "/api/v1/scans/local",
        data={"project_name": "Demo", "application_name": "demo-app", "version": "1.0.0"},
        files={"file": ("package.json", io.BytesIO(manifest), "application/json")},
        headers={"X-Organization-Id": "default"},
    )
    assert created.status_code == 202, created.text
    scan_id = created.json()["data"]["scan_id"]

    job = app.state.orch.queue.claim(60)
    assert job is not None
    app.state.orch.execute(job)
    app.state.orch.queue.complete(job["id"])

    status = client.get(f"/api/v1/scans/{scan_id}/status", headers={"X-Organization-Id": "default"})
    assert status.json()["data"]["status"] == "COMPLETED"
    comps = client.get(f"/api/v1/scans/{scan_id}/components", headers={"X-Organization-Id": "default"})
    names = {row["name"] for row in comps.json()["data"]}
    assert "left-pad" in names

    exported = client.get(f"/api/v1/scans/{scan_id}/export?format=csv", headers={"X-Organization-Id": "default"}, follow_redirects=True)
    assert exported.status_code == 200
    assert b"left-pad" in exported.content

    spdx_exp = client.get(f"/api/v1/scans/{scan_id}/export?format=spdx-json", headers={"X-Organization-Id": "default"}, follow_redirects=True)
    assert spdx_exp.status_code == 200
    assert "SPDX-2.3" in spdx_exp.text
    assert "left-pad" in spdx_exp.text

    cdx_exp = client.get(f"/api/v1/scans/{scan_id}/export?format=cyclonedx-json", headers={"X-Organization-Id": "default"}, follow_redirects=True)
    assert cdx_exp.status_code == 200
    assert "CycloneDX" in cdx_exp.text
    assert "left-pad" in cdx_exp.text


def _component_versions(name: str) -> list[str]:
    conn = psycopg.connect(TEST_DB, autocommit=True)
    rows = conn.execute(
        "SELECT version FROM sbom_components WHERE lower(name) = lower(%s) ORDER BY version",
        (name,),
    ).fetchall()
    conn.close()
    return [row[0] for row in rows]


def _run_local(app, client, application: str, manifest: dict) -> str:
    created = client.post(
        "/api/v1/scans/local",
        data={"project_name": "Demo", "application_name": application, "version": "1.0.0"},
        files={"file": ("package.json", io.BytesIO(json.dumps(manifest).encode()), "application/json")},
        headers={"X-Organization-Id": "default"},
    )
    assert created.status_code == 202, created.text
    job = app.state.orch.queue.claim(60)
    assert job is not None
    app.state.orch.execute(job)
    app.state.orch.queue.complete(job["id"])
    return created.json()["data"]["scan_id"]


def test_same_package_version_is_not_stored_twice(tmp_path):
    _fresh(tmp_path / "objects")
    app = build()
    client = TestClient(app)
    _run_local(app, client, "demo-app", {"name": "demo", "version": "1.0.0", "dependencies": {"left-pad": "1.3.0"}})
    assert _component_versions("left-pad") == ["1.3.0"]

    _run_local(app, client, "other-app", {"name": "other", "version": "1.0.0", "dependencies": {"left-pad": "1.3.0", "lodash": "4.17.21"}})
    assert _component_versions("left-pad") == ["1.3.0"]
    assert _component_versions("lodash") == ["4.17.21"]

    _run_local(app, client, "third-app", {"name": "third", "version": "2.0.0", "dependencies": {"left-pad": "1.4.0"}})
    assert _component_versions("left-pad") == ["1.3.0", "1.4.0"]


def test_folder_zip_and_parsers(tmp_path):
    _fresh(tmp_path / "objects")
    app = build()
    client = TestClient(app)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("go.mod", "module example.com/demo\n\ngo 1.22\n\nrequire example.com/lib v1.2.3\n")
    created = client.post(
        "/api/v1/scans/local",
        data={"project_name": "Go", "application_name": "go-app", "version": "1"},
        files={"file": ("lib.zip", io.BytesIO(buf.getvalue()), "application/zip")},
        headers={"X-Organization-Id": "default"},
    )
    assert created.status_code == 202, created.text
    job = app.state.orch.queue.claim(60)
    app.state.orch.execute(job)
    scan_id = created.json()["data"]["scan_id"]
    comps = client.get(f"/api/v1/scans/{scan_id}/components", headers={"X-Organization-Id": "default"})
    assert any(row["name"] == "example.com/lib" for row in comps.json()["data"])


def test_rescan_completed_and_failed(tmp_path):
    _fresh(tmp_path / "objects")
    app = build()
    client = TestClient(app)
    headers = {"X-Organization-Id": "default"}
    scan_id = _run_local(app, client, "demo-app", {"name": "demo", "version": "1.0.0", "dependencies": {"left-pad": "1.3.0"}})

    again = client.post(f"/api/v1/scans/{scan_id}/rescan", headers=headers)
    assert again.status_code == 202, again.text
    assert again.json()["data"]["status"] == "QUEUED"
    assert again.json()["data"]["scan_id"] == scan_id

    blocked = client.post(f"/api/v1/scans/{scan_id}/rescan", headers=headers)
    assert blocked.status_code == 409

    job = app.state.orch.queue.claim(60)
    assert job is not None
    assert job["scan_id"] == scan_id
    app.state.orch.execute(job)
    app.state.orch.queue.complete(job["id"])
    status = client.get(f"/api/v1/scans/{scan_id}/status", headers=headers)
    assert status.json()["data"]["status"] == "COMPLETED"
    comps = client.get(f"/api/v1/scans/{scan_id}/components", headers=headers)
    assert "left-pad" in {row["name"] for row in comps.json()["data"]}

    app.state.scans.mark_failed(scan_id, "SCANNER_FAILED", "boom")
    failed = client.post(f"/api/v1/scans/{scan_id}/rescan", headers=headers)
    assert failed.status_code == 202, failed.text
    assert failed.json()["data"]["status"] == "QUEUED"

    missing = client.post("/api/v1/scans/missing-scan/rescan", headers=headers)
    assert missing.status_code == 404


def test_cancel_queued_and_running_scan(tmp_path):
    from app.scans.orchestrator import ScanCancelled

    _fresh(tmp_path / "objects")
    app = build()
    client = TestClient(app)
    headers = {"X-Organization-Id": "default"}

    queued = client.post(
        "/api/v1/scans/local",
        data={"project_name": "Demo", "application_name": "cancel-queued", "version": "1.0.0"},
        files={"file": ("package.json", io.BytesIO(json.dumps({"name": "queued", "version": "1.0.0", "dependencies": {"left-pad": "1.3.0"}}).encode()), "application/json")},
        headers=headers,
    )
    assert queued.status_code == 202, queued.text
    queued_id = queued.json()["data"]["scan_id"]
    cancelled = client.post(f"/api/v1/scans/{queued_id}/cancel", headers=headers)
    assert cancelled.status_code == 202, cancelled.text
    assert cancelled.json()["data"]["status"] == "CANCELLED"
    assert app.state.orch.queue.claim(60) is None
    again = client.post(f"/api/v1/scans/{queued_id}/cancel", headers=headers)
    assert again.status_code == 409

    running = client.post(
        "/api/v1/scans/local",
        data={"project_name": "Demo", "application_name": "cancel-running", "version": "1.0.0"},
        files={"file": ("package.json", io.BytesIO(json.dumps({"name": "running", "version": "1.0.0", "dependencies": {"lodash": "4.17.21"}}).encode()), "application/json")},
        headers=headers,
    )
    assert running.status_code == 202, running.text
    running_id = running.json()["data"]["scan_id"]
    job = app.state.orch.queue.claim(60)
    assert job is not None and job["scan_id"] == running_id
    stopped = client.post(f"/api/v1/scans/{running_id}/cancel", headers=headers)
    assert stopped.status_code == 202, stopped.text
    try:
        app.state.orch.execute(job)
    except ScanCancelled:
        pass
    else:
        raise AssertionError("a cancelled scan should stop before it completes")
    status = client.get(f"/api/v1/scans/{running_id}/status", headers=headers)
    assert status.json()["data"]["status"] == "CANCELLED"
    app.state.orch.queue.complete(job["id"])
    assert client.get(f"/api/v1/scans/{running_id}/status", headers=headers).json()["data"]["status"] == "CANCELLED"


