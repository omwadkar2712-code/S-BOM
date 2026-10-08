"""Manual inventory entries are stored and read back with the catalog fields."""

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


def _fresh() -> None:
    conn = psycopg.connect(TEST_DB, autocommit=True)
    conn.execute("DROP SCHEMA IF EXISTS public CASCADE")
    conn.execute("CREATE SCHEMA public")
    conn.execute("GRANT ALL ON SCHEMA public TO PUBLIC")
    conn.close()
    os.environ["DATABASE_URL"] = TEST_DB


def test_inventory_component_is_saved_and_listed():
    _fresh()
    client = TestClient(build())
    headers = {"X-Organization-Id": "default"}
    created = client.post(
        "/api/v1/inventory/components",
        headers=headers,
        json={
            "components": [
                {
                    "project": "checkout-api",
                    "project_application": "payments-service",
                    "name": "log4j-core",
                    "package_name": "org.apache.logging.log4j:log4j-core",
                    "version": "2.17.1",
                    "field_type": "Library",
                    "license": "Apache-2.0",
                    "cves": 2,
                    "ecosystem": "Maven",
                    "risk": "High",
                    "purl": "pkg:maven/org.apache.logging.log4j:log4j-core@2.17.1",
                    "direct_dependency": False,
                }
            ]
        },
    )
    assert created.status_code == 201
    saved = created.json()["data"][0]
    assert saved["name"] == "log4j-core"
    assert saved["project"] == "checkout-api"
    assert saved["cves"] == 2
    assert saved["direct"] is False

    listed = client.get("/api/v1/inventory/components?limit=1", headers=headers)
    assert listed.status_code == 200
    page = listed.json()["data"]
    rows = page["items"]
    assert len(rows) == 1
    assert page["next_cursor"] is None
    row = rows[0]
    assert row["id"] == saved["id"]
    assert row["package_name"] == "org.apache.logging.log4j:log4j-core"
    assert row["project_application"] == "payments-service"
    assert row["field_type"] == "Library"
    assert row["license"] == "Apache-2.0"
    assert row["ecosystem"] == "Maven"
    assert row["risk"] == "High"
    assert row["purl"] == "pkg:maven/org.apache.logging.log4j:log4j-core@2.17.1"

    again = client.post(
        "/api/v1/inventory/components",
        headers=headers,
        json={
            "components": [
                {
                    "project": "checkout-api",
                    "project_application": "payments-service",
                    "name": "axios",
                    "version": "1.7.4",
                    "ecosystem": "npm",
                }
            ]
        },
    )
    assert again.status_code == 201
    first_page = client.get("/api/v1/inventory/components?limit=1", headers=headers)
    assert first_page.status_code == 200
    body = first_page.json()["data"]
    assert len(body["items"]) == 1
    assert body["next_cursor"]
    second_page = client.get(
        "/api/v1/inventory/components",
        headers=headers,
        params={"limit": 1, "cursor": body["next_cursor"]},
    )
    assert len(second_page.json()["data"]["items"]) == 1
    assert second_page.json()["data"]["next_cursor"] is None
    with psycopg.connect(TEST_DB, autocommit=True) as conn:
        projects = conn.execute(
            "SELECT COUNT(*) FROM tbl_projects_and_microservices WHERE project_name = %s",
            ("checkout-api",),
        ).fetchone()[0]
        services = conn.execute(
            "SELECT COUNT(*) FROM tbl_project_applications_and_services WHERE service_name = %s",
            ("payments-service",),
        ).fetchone()[0]
        components = conn.execute(
            "SELECT COUNT(*) FROM tbl_software_components_and_packages WHERE component_name = %s",
            ("log4j-core",),
        ).fetchone()[0]
        snapshots = conn.execute(
            "SELECT COUNT(*) FROM tbl_bom_snapshots WHERE scanner_name = 'manual'"
        ).fetchone()[0]
    assert projects == 1
    assert services == 1
    assert components == 1
    assert snapshots == 0

    missing = client.post(
        "/api/v1/inventory/components",
        headers=headers,
        json={"components": [{"name": "only-name"}]},
    )
    assert missing.status_code == 400
