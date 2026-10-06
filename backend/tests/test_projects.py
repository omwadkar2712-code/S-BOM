"""Projects dashboard aggregates scans into KPI + table rows."""

from __future__ import annotations

from app.projects.dashboard import list_projects
from app.vulnerabilities.provider import VulnProvider


class _FakeScans:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows

    def list_scans(self, org_id: str, limit: int = 100) -> list[dict]:
        return [row for row in self.rows if row.get("organization_id") == org_id][:limit]


class _FakeBoms:
    def __init__(self, snaps: dict[str, dict]) -> None:
        self.snaps = snaps

    def get_snapshot(self, snapshot_id: str) -> dict | None:
        return self.snaps.get(snapshot_id)


def test_projects_dashboard_groups_scans_and_summary():
    scans = _FakeScans(
        [
            {
                "id": "s1",
                "organization_id": "default",
                "project_id": "Payments",
                "application_id": "pay-api",
                "application_name": "pay-api",
                "source_type": "LOCAL",
                "status": "COMPLETED",
                "snapshot_id": "snap-1",
                "created_at": "2026-01-01T00:00:00Z",
                "completed_at": "2026-01-01T01:00:00Z",
            },
            {
                "id": "s2",
                "organization_id": "default",
                "project_id": "Payments",
                "application_id": "pay-api",
                "application_name": "pay-api",
                "source_type": "LOCAL",
                "status": "COMPLETED",
                "snapshot_id": "snap-2",
                "created_at": "2026-01-02T00:00:00Z",
                "completed_at": "2026-01-02T01:00:00Z",
            },
            {
                "id": "s3",
                "organization_id": "default",
                "project_id": "Auth",
                "application_id": "auth-svc",
                "application_name": "auth-svc",
                "source_type": "GITHUB",
                "status": "COMPLETED",
                "snapshot_id": "snap-3",
                "created_at": "2026-01-03T00:00:00Z",
                "completed_at": "2026-01-03T01:00:00Z",
            },
            {
                "id": "s4",
                "organization_id": "other",
                "project_id": "OtherOrg",
                "application_id": "x",
                "application_name": "x",
                "source_type": "LOCAL",
                "status": "COMPLETED",
                "snapshot_id": "snap-x",
                "created_at": "2026-01-04T00:00:00Z",
                "completed_at": "2026-01-04T01:00:00Z",
            },
        ]
    )
    boms = _FakeBoms(
        {
            "snap-2": {
                "raw_metadata": {
                    "vulnerability_matches": [
                        {"vulnerability_id": "CVE-1", "severity": "CRITICAL"},
                        {"vulnerability_id": "CVE-2", "severity": "HIGH"},
                    ]
                },
                "components": [
                    {"id": "c1", "raw": {"compliance_pass": True}},
                    {"id": "c2", "raw": {"compliance_pass": False}},
                ],
            },
            "snap-3": {
                "raw_metadata": {"vulnerability_matches": []},
                "components": [
                    {"id": "c3", "raw": {"compliance_pass": True}},
                    {"id": "c4", "raw": {"compliance_pass": True}},
                ],
            },
        }
    )

    data = list_projects(scans, boms, "default")
    assert data["summary"]["project_count"] == 2
    assert data["summary"]["total_scans"] == 3
    assert data["summary"]["sbom_files"] == 3
    assert data["summary"]["compliant_count"] == 1

    by_name = {row["name"]: row for row in data["projects"]}
    assert by_name["Payments"]["scans"] == 2
    assert by_name["Payments"]["vulns"] == 2
    assert by_name["Payments"]["risk"] == "High Risk"
    assert by_name["Payments"]["compliance"] == "50.0%"
    assert by_name["Payments"]["classifier"] == "Service / Microservice"
    assert "Local" in by_name["Payments"]["tags"]

    assert by_name["Auth"]["risk"] == "Healthy"
    assert by_name["Auth"]["compliance"] == "100.0%"
    assert by_name["Auth"]["classifier"] == "Web Application"
    assert "GitHub" in by_name["Auth"]["tags"]


def test_projects_status_and_search_filters():
    scans = _FakeScans(
        [
            {
                "id": "s1",
                "organization_id": "default",
                "project_id": "Alpha",
                "application_id": "a",
                "application_name": "a",
                "source_type": "LOCAL",
                "status": "COMPLETED",
                "snapshot_id": "snap-a",
                "created_at": "2026-01-01T00:00:00Z",
                "completed_at": "2026-01-01T01:00:00Z",
            },
            {
                "id": "s2",
                "organization_id": "default",
                "project_id": "Beta Service",
                "application_id": "b",
                "application_name": "b",
                "source_type": "LOCAL",
                "status": "COMPLETED",
                "snapshot_id": "snap-b",
                "created_at": "2026-01-02T00:00:00Z",
                "completed_at": "2026-01-02T01:00:00Z",
            },
        ]
    )
    boms = _FakeBoms(
        {
            "snap-a": {
                "raw_metadata": {"vulnerability_matches": [{"vulnerability_id": "CVE-9", "severity": "CRITICAL"}]},
                "components": [{"id": "1", "raw": {"compliance_pass": True}}],
            },
            "snap-b": {
                "raw_metadata": {"vulnerability_matches": []},
                "components": [{"id": "2", "raw": {"compliance_pass": True}}],
            },
        }
    )
    high = list_projects(scans, boms, "default", status="High Risk")
    assert [row["name"] for row in high["projects"]] == ["Alpha"]
    assert high["summary"]["project_count"] == 2

    search = list_projects(scans, boms, "default", q="beta")
    assert [row["name"] for row in search["projects"]] == ["Beta Service"]


def test_mitre_targets_still_cover_project_components():
    """Sanity: vuln provider still maps ecosystems used by scanned projects."""
    provider = VulnProvider("mitre", 5, "https://cveawg.mitre.org/api")
    snap = {
        "components": [
            {"id": "1", "name": "lodash", "version": "4.17.15", "ecosystem": "npm"},
            {"id": "2", "name": "flask", "version": "2.0.1", "ecosystem": "pypi"},
        ]
    }
    targets = provider._targets(snap)
    assert len(targets) == 2
