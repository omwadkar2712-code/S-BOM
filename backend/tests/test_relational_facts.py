"""Snapshot vulnerabilities, hashes, and compliance are stored as rows."""

import base64
import json
import os
import uuid

import psycopg

TEST_DB = "postgresql://sbom:sbom@127.0.0.1:5432/sbom_test"

os.environ["CREDENTIAL_KEK"] = base64.b64encode(b"0123456789abcdef0123456789abcdef").decode()
os.environ["DATABASE_URL"] = TEST_DB
os.environ["OBJECT_STORAGE_URL"] = "local://./data/test-objects"
os.environ["API_ALLOW_ORIGINS"] = "http://127.0.0.1:5173"
os.environ["VULN_PROVIDER"] = "osv"

from app.catalog.store import CatalogRepo  # noqa: E402
from app.core.config import load  # noqa: E402
from app.core.db import connect, migrate  # noqa: E402
from app.repositories.store import BomRepo, ScanRepo, utcnow  # noqa: E402


def _fresh():
    conn = psycopg.connect(TEST_DB, autocommit=True)
    conn.execute("DROP SCHEMA IF EXISTS public CASCADE")
    conn.execute("CREATE SCHEMA public")
    conn.execute("GRANT ALL ON SCHEMA public TO PUBLIC")
    conn.close()
    os.environ["DATABASE_URL"] = TEST_DB
    db = connect(load())
    migrate(db)
    return db


def test_snapshot_facts_are_relational_and_round_trip():
    db = _fresh()
    catalog = CatalogRepo(db)
    bound = catalog.ensure_named("default", "Payments", "checkout")
    scan_id = str(uuid.uuid4())
    ScanRepo(db).create_scan(
        {
            "id": scan_id,
            "organization_id": "default",
            "project_id": "Payments",
            "application_id": "checkout",
            "application_name": "checkout",
            "application_version": "1.0.0",
            "version_strategy": "VERSION_MANUAL",
            "bom_type": "SBOM",
            "source_type": "GITHUB",
            "status": "PENDING",
            "stage": "QUEUED",
            "idempotency_key": "facts-" + scan_id,
            "created_at": utcnow(),
        }
    )
    linked = db.execute(
        """SELECT catalog_project_id, catalog_application_id
           FROM scans WHERE id = ?""",
        (scan_id,),
    ).fetchone()
    assert linked["catalog_project_id"] == bound.project_id
    assert linked["catalog_application_id"] == bound.application_id

    component_id = str(uuid.uuid4())
    snapshot_id = str(uuid.uuid4())
    BomRepo(db).save_snapshot(
        {
            "id": snapshot_id,
            "organization_id": "default",
            "project_id": "Payments",
            "application_id": "checkout",
            "scan_id": scan_id,
            "bom_type": "SBOM",
            "application_version": "1.0.0",
            "version_strategy": "VERSION_MANUAL",
            "repository_url": "https://github.com/acme/payments",
            "repository_branch": "main",
            "commit_sha": "abc123",
            "commit_author": "Ada",
            "commit_email": "ada@example.com",
            "commit_message": "init",
            "scanner_name": "test",
            "scanner_version": "1",
            "generated_at": utcnow(),
            "raw_metadata": {
                "vulnerability_provider": "mitre",
                "vulnerability_matches": [
                    {
                        "component_id": component_id,
                        "vulnerability_id": "CVE-2021-3749",
                        "source": "mitre",
                        "severity": "HIGH",
                        "cvss_score": 7.5,
                        "cvss_vector": "CVSS:3.1/AV:N",
                        "description": "ReDoS in axios",
                        "fixed_version": "0.21.2",
                        "references": ["https://nvd.nist.gov/vuln/detail/CVE-2021-3749"],
                    }
                ],
            },
            "components": [
                {
                    "id": component_id,
                    "name": "axios",
                    "version": "0.21.1",
                    "ecosystem": "npm",
                    "purl": "pkg:npm/axios@0.21.1",
                    "license": "MIT",
                    "supplier": "axios",
                    "direct": True,
                    "raw": {
                        "depth": 1,
                        "hashes": {"SHA-256": "sha256-abc"},
                        "compliance_status": {
                            "ntia_supplier": True,
                            "ntia_name": True,
                            "ntia_version": True,
                            "ntia_identifier": True,
                            "ntia_relationship": True,
                            "ntia_author": True,
                            "ntia_timestamp": True,
                        },
                        "compliance_pass": True,
                        "vulnerabilities": [{"id": "CVE-2021-3749"}],
                    },
                }
            ],
            "dependencies": [],
        }
    )

    stored = db.execute(
        """SELECT raw_metadata, facts_normalized, repository_url, commit_sha, catalog_project_id
           FROM sboms WHERE id = ?""",
        (snapshot_id,),
    ).fetchone()
    assert stored["facts_normalized"] is True
    assert stored["repository_url"] == "https://github.com/acme/payments"
    assert stored["commit_sha"] == "abc123"
    assert stored["catalog_project_id"] == bound.project_id
    assert "vulnerability_matches" not in json.loads(stored["raw_metadata"])

    finding = db.execute(
        """SELECT v.vulnerability_key, v.reference_urls, f.severity, f.fixed_version
           FROM findings f
           JOIN vulnerabilities v ON v.id = f.vulnerability_id
           WHERE f.sbom_id = ?""",
        (snapshot_id,),
    ).fetchone()
    assert finding["vulnerability_key"] == "CVE-2021-3749"
    assert finding["severity"] == "HIGH"
    assert finding["fixed_version"] == "0.21.2"
    assert list(finding["reference_urls"]) == ["https://nvd.nist.gov/vuln/detail/CVE-2021-3749"]
    component_row = db.execute(
        """SELECT name, version, ntia_supplier, ntia_timestamp
           FROM sbom_components WHERE sbom_id = ?""",
        (snapshot_id,),
    ).fetchone()
    assert component_row["name"] == "axios"
    assert component_row["version"] == "0.21.1"
    assert component_row["ntia_supplier"] is True
    assert component_row["ntia_timestamp"] is True

    loaded = BomRepo(db).get_snapshot(snapshot_id)
    match = loaded["raw_metadata"]["vulnerability_matches"][0]
    assert match["vulnerability_id"] == "CVE-2021-3749"
    assert match["cvss_score"] == 7.5
    assert match["references"] == ["https://nvd.nist.gov/vuln/detail/CVE-2021-3749"]
    component = loaded["components"][0]
    assert component["raw"]["compliance_pass"] is True
    assert component["raw"]["hashes"]["SHA-256"] == "sha256-abc"
    assert component["raw"]["depth"] == 1
    assert component["raw"]["vulnerabilities"][0]["id"] == "CVE-2021-3749"
