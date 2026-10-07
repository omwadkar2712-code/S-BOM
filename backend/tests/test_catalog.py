"""Catalog APIs for Project → Application/Service dependent dropdowns."""

from __future__ import annotations

import base64
import os

import psycopg
from fastapi.testclient import TestClient

TEST_DB = "postgresql://sbom:sbom@127.0.0.1:5432/sbom_test"

os.environ["CREDENTIAL_KEK"] = base64.b64encode(b"0123456789abcdef0123456789abcdef").decode()
os.environ["DATABASE_URL"] = TEST_DB
os.environ["OBJECT_STORAGE_URL"] = "local://./data/test-objects"
os.environ["API_ALLOW_ORIGINS"] = "http://127.0.0.1:5173"
os.environ["VULN_PROVIDER"] = "osv"

from app.api import build  # noqa: E402
from app.catalog import CatalogError, CatalogRepo  # noqa: E402


HEADERS = {"X-Organization-Id": "default"}
OTHER = {"X-Organization-Id": "other-org"}


def _fresh() -> None:
    conn = psycopg.connect(TEST_DB, autocommit=True)
    conn.execute("DROP SCHEMA IF EXISTS public CASCADE")
    conn.execute("CREATE SCHEMA public")
    conn.execute("GRANT ALL ON SCHEMA public TO PUBLIC")
    conn.close()
    os.environ["DATABASE_URL"] = TEST_DB


def _client() -> TestClient:
    _fresh()
    return TestClient(build())


def _seed(client: TestClient) -> dict[str, dict]:
    payments = client.post(
        "/api/v1/catalog/projects",
        headers=HEADERS,
        json={"name": "Project A", "applications": [{"name": "App 1"}, {"name": "App 2"}]},
    )
    assert payments.status_code == 201, payments.text
    auth = client.post(
        "/api/v1/catalog/projects",
        headers=HEADERS,
        json={"name": "Project B", "applications": [{"name": "Service 1"}]},
    )
    empty = client.post(
        "/api/v1/catalog/projects",
        headers=HEADERS,
        json={"name": "Project C", "applications": []},
    )
    other = client.post(
        "/api/v1/catalog/projects",
        headers=OTHER,
        json={"name": "Project A", "applications": [{"name": "Foreign App"}]},
    )
    return {
        "a": payments.json()["data"],
        "b": auth.json()["data"],
        "c": empty.json()["data"],
        "other": other.json()["data"],
    }


def test_list_projects_from_database_not_hardcoded():
    client = _client()
    seeded = _seed(client)
    listed = client.get("/api/v1/catalog/projects", headers=HEADERS)
    assert listed.status_code == 200
    items = listed.json()["data"]["items"]
    names = [row["name"] for row in items]
    assert names == ["Project A", "Project B", "Project C"]
    ids = {row["id"] for row in items}
    assert seeded["a"]["id"] in ids
    assert seeded["other"]["id"] not in ids


def test_project_search_and_pagination():
    client = _client()
    _seed(client)
    search = client.get("/api/v1/catalog/projects", headers=HEADERS, params={"q": "project b"})
    assert [row["name"] for row in search.json()["data"]["items"]] == ["Project B"]

    page1 = client.get("/api/v1/catalog/projects", headers=HEADERS, params={"limit": 1})
    body = page1.json()["data"]
    assert len(body["items"]) == 1
    assert body["items"][0]["name"] == "Project A"
    assert body["next_cursor"]
    page2 = client.get(
        "/api/v1/catalog/projects",
        headers=HEADERS,
        params={"limit": 1, "cursor": body["next_cursor"]},
    )
    assert page2.json()["data"]["items"][0]["name"] == "Project B"


def test_applications_only_belong_to_selected_project():
    client = _client()
    seeded = _seed(client)
    apps = client.get(
        f"/api/v1/catalog/projects/{seeded['a']['id']}/applications-services",
        headers=HEADERS,
    )
    assert apps.status_code == 200
    items = apps.json()["data"]["items"]
    assert [row["name"] for row in items] == ["App 1", "App 2"]
    assert all(row["project_id"] == seeded["a"]["id"] for row in items)

    empty = client.get(
        f"/api/v1/catalog/projects/{seeded['c']['id']}/applications-services",
        headers=HEADERS,
    )
    assert empty.json()["data"]["items"] == []
    assert empty.json()["data"]["next_cursor"] is None

    missing = client.get("/api/v1/catalog/projects/does-not-exist/applications-services", headers=HEADERS)
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "PROJECT_NOT_FOUND"


def test_changing_projects_returns_different_applications():
    client = _client()
    seeded = _seed(client)
    first = client.get(f"/api/v1/catalog/projects/{seeded['a']['id']}/applications-services", headers=HEADERS)
    second = client.get(f"/api/v1/catalog/projects/{seeded['b']['id']}/applications-services", headers=HEADERS)
    assert [row["name"] for row in first.json()["data"]["items"]] == ["App 1", "App 2"]
    assert [row["name"] for row in second.json()["data"]["items"]] == ["Service 1"]


def test_tenant_cannot_read_or_bind_foreign_catalog():
    client = _client()
    seeded = _seed(client)
    hidden = client.get(f"/api/v1/catalog/projects/{seeded['other']['id']}/applications-services", headers=HEADERS)
    assert hidden.status_code == 404
    listed = client.get("/api/v1/catalog/projects", headers=OTHER)
    assert [row["name"] for row in listed.json()["data"]["items"]] == ["Project A"]


def test_scan_rejects_application_from_another_project():
    client = _client()
    seeded = _seed(client)
    foreign_app = seeded["b"]["applications"][0]["id"]
    rejected = client.post(
        "/api/v1/scans/github",
        headers=HEADERS,
        json={
            "repository_url": "https://github.com/example/repo",
            "project_id": seeded["a"]["id"],
            "application_id": foreign_app,
            "project_name": "ignored",
            "application_name": "ignored",
            "version": "1.0.0",
        },
    )
    assert rejected.status_code == 400
    assert rejected.json()["error"]["code"] == "APPLICATION_PROJECT_MISMATCH"


def test_scan_rejects_unknown_ids():
    client = _client()
    _seed(client)
    missing_project = client.post(
        "/api/v1/scans/github",
        headers=HEADERS,
        json={
            "repository_url": "https://github.com/example/repo",
            "project_id": "missing-project",
            "application_id": "missing-app",
            "application_name": "x",
        },
    )
    assert missing_project.status_code == 404
    assert missing_project.json()["error"]["code"] == "PROJECT_NOT_FOUND"


def test_scan_accepts_valid_ids_and_name_only_legacy():
    client = _client()
    seeded = _seed(client)
    app = seeded["a"]["applications"][0]
    ok = client.post(
        "/api/v1/scans/github",
        headers=HEADERS,
        json={
            "repository_url": "https://github.com/example/valid-ids",
            "project_id": seeded["a"]["id"],
            "application_id": app["id"],
            "version": "2.0.0",
        },
    )
    assert ok.status_code == 202, ok.text

    legacy = client.post(
        "/api/v1/scans/github",
        headers=HEADERS,
        json={
            "repository_url": "https://github.com/example/legacy-names",
            "project_name": "Legacy Project",
            "application_name": "legacy-svc",
            "version": "1.0.0",
        },
    )
    assert legacy.status_code == 202, legacy.text
    listed = client.get("/api/v1/catalog/projects", headers=HEADERS, params={"q": "Legacy"})
    assert listed.json()["data"]["items"][0]["name"] == "Legacy Project"
    legacy_id = listed.json()["data"]["items"][0]["id"]
    apps = client.get(f"/api/v1/catalog/projects/{legacy_id}/applications-services", headers=HEADERS)
    assert [row["name"] for row in apps.json()["data"]["items"]] == ["legacy-svc"]


def test_inventory_validates_project_application_ids():
    client = _client()
    seeded = _seed(client)
    app = seeded["a"]["applications"][0]
    saved = client.post(
        "/api/v1/inventory/components",
        headers=HEADERS,
        json={
            "components": [
                {
                    "project_id": seeded["a"]["id"],
                    "application_id": app["id"],
                    "project": "wrong-name",
                    "project_application": "wrong-app",
                    "name": "lodash",
                    "version": "4.17.21",
                    "ecosystem": "npm",
                }
            ]
        },
    )
    assert saved.status_code == 201, saved.text
    assert saved.json()["data"][0]["project"] == "Project A"
    assert saved.json()["data"][0]["project_application"] == "App 1"

    rejected = client.post(
        "/api/v1/inventory/components",
        headers=HEADERS,
        json={
            "components": [
                {
                    "project_id": seeded["a"]["id"],
                    "application_id": seeded["b"]["applications"][0]["id"],
                    "project": "Project A",
                    "project_application": "Service 1",
                    "name": "axios",
                    "version": "1.7.4",
                }
            ]
        },
    )
    assert rejected.status_code == 400
    assert rejected.json()["error"]["code"] == "APPLICATION_PROJECT_MISMATCH"


def test_bind_rejects_stale_application_after_project_switch():
    _fresh()
    app = build()
    repo: CatalogRepo = app.state.catalog
    first = repo.create_project("default", "Alpha", ["one"])
    second = repo.create_project("default", "Beta", ["two"])
    try:
        repo.bind(
            "default",
            project_id=first["id"],
            application_id=second["applications"][0]["id"],
        )
        raise AssertionError("mismatch should not bind")
    except CatalogError as exc:
        assert exc.code == "APPLICATION_PROJECT_MISMATCH"
        assert exc.status == 400


def test_name_only_inventory_still_creates_catalog_rows():
    client = _client()
    created = client.post(
        "/api/v1/inventory/components",
        headers=HEADERS,
        json={
            "components": [
                {
                    "project": "checkout-api",
                    "project_application": "payments-service",
                    "name": "log4j-core",
                    "version": "2.17.1",
                }
            ]
        },
    )
    assert created.status_code == 201
    projects = client.get("/api/v1/catalog/projects", headers=HEADERS)
    assert projects.json()["data"]["items"][0]["name"] == "checkout-api"
    project_id = projects.json()["data"]["items"][0]["id"]
    apps = client.get(f"/api/v1/catalog/projects/{project_id}/applications-services", headers=HEADERS)
    assert apps.json()["data"]["items"][0]["name"] == "payments-service"


def test_dashboard_projects_endpoint_is_unchanged():
    client = _client()
    listed = client.get("/api/v1/projects", headers=HEADERS)
    assert listed.status_code == 200
    body = listed.json()["data"]
    assert "summary" in body
    assert "projects" in body


def test_search_wildcards_are_literal_and_invalid_cursor_fails():
    client = _client()
    client.post(
        "/api/v1/catalog/projects",
        headers=HEADERS,
        json={"name": "100% Pay", "applications": [{"name": "app_one"}]},
    )
    client.post(
        "/api/v1/catalog/projects",
        headers=HEADERS,
        json={"name": "Pay", "applications": [{"name": "other"}]},
    )
    match = client.get("/api/v1/catalog/projects", headers=HEADERS, params={"q": "100%"})
    assert [row["name"] for row in match.json()["data"]["items"]] == ["100% Pay"]
    bad = client.get("/api/v1/catalog/projects", headers=HEADERS, params={"cursor": "broken"})
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "INVALID_INPUT"


def test_typed_project_and_application_are_created():
    client = _client()
    project = client.post(
        "/api/v1/catalog/projects",
        headers=HEADERS,
        json={"name": "Typed Project"},
    )
    assert project.status_code == 201
    project_id = project.json()["data"]["id"]
    assert project.json()["data"]["applications"] == []

    created = client.post(
        f"/api/v1/catalog/projects/{project_id}/applications-services",
        headers=HEADERS,
        json={"name": "typed-api"},
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    assert body["name"] == "typed-api"
    assert body["project_id"] == project_id

    listed = client.get(f"/api/v1/catalog/projects/{project_id}/applications-services", headers=HEADERS)
    assert [row["name"] for row in listed.json()["data"]["items"]] == ["typed-api"]

    again = client.post(
        f"/api/v1/catalog/projects/{project_id}/applications-services",
        headers=HEADERS,
        json={"name": "typed-api"},
    )
    assert again.status_code == 201
    assert again.json()["data"]["id"] == body["id"]
