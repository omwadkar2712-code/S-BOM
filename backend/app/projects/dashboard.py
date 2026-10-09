"""Aggregate scan + snapshot data into Projects & Microservices rows."""

from __future__ import annotations

from typing import Any, Protocol

RISK_HIGH = "High Risk"
RISK_ATTENTION = "Needs Attention"
RISK_HEALTHY = "Healthy"

CLASSIFIER_BY_SOURCE = {
    "LOCAL": "Service / Microservice",
    "GITHUB": "Web Application",
    "BULK": "Service / Microservice",
}


class _ScanStore(Protocol):
    def list_scans(self, org_id: str, limit: int = 100) -> list[dict[str, Any]]: ...


class _BomStore(Protocol):
    def get_snapshot(self, snapshot_id: str) -> dict[str, Any] | None: ...


def list_projects(
    scans: _ScanStore,
    boms: _BomStore,
    org_id: str,
    *,
    q: str = "",
    status: str = "",
    limit: int = 500,
) -> dict[str, Any]:
    """Build summary KPIs and project rows from scans for one organization."""
    rows = scans.list_scans(org_id, limit=limit)
    groups: dict[str, dict[str, Any]] = {}

    for scan in rows:
        key = _project_key(scan)
        if not key:
            continue
        group = groups.get(key)
        if group is None:
            group = {
                "id": key,
                "name": _project_name(scan),
                "scan_rows": [],
                "sources": set(),
            }
            groups[key] = group
        group["scan_rows"].append(scan)
        if scan.get("source_type"):
            group["sources"].add(str(scan["source_type"]).upper())

    projects = []
    total_scans = 0
    sbom_files = 0
    compliant_projects = 0

    for group in groups.values():
        scan_rows = group["scan_rows"]
        total_scans += len(scan_rows)
        completed = [s for s in scan_rows if (s.get("status") or "").upper() == "COMPLETED" and s.get("snapshot_id")]
        sbom_files += len({s["snapshot_id"] for s in completed if s.get("snapshot_id")})

        latest = _latest_scan(scan_rows)
        latest_done = _latest_scan(completed) if completed else None
        snap = boms.get_snapshot(latest_done["snapshot_id"]) if latest_done else None
        stats = _snapshot_stats(snap) if snap else _empty_stats()

        compliance_pct = stats["compliance_pct"]
        if stats["component_count"] > 0 and compliance_pct >= 80.0:
            compliant_projects += 1

        risk = _risk(stats)
        sources = sorted(group["sources"])
        classifier = CLASSIFIER_BY_SOURCE.get(sources[0] if sources else "", "Service / Microservice")
        tags = _tags(sources, classifier)

        projects.append(
            {
                "id": group["id"],
                "name": group["name"],
                "classifier": classifier,
                "risk": risk,
                "compliance": f"{compliance_pct:.1f}%",
                "compliance_pct": compliance_pct,
                "compliant_components": stats["compliant_components"],
                "component_count": stats["component_count"],
                "vulns": stats["vuln_count"],
                "vuln_critical": stats["vuln_critical"],
                "vuln_high": stats["vuln_high"],
                "scans": len(scan_rows),
                "tags": tags,
                "last_scanned_at": latest.get("completed_at") or latest.get("created_at") or "",
                "latest_scan_id": latest.get("id") or "",
                "latest_snapshot_id": (latest_done or {}).get("snapshot_id") or "",
                "source_types": sources,
            }
        )

    projects.sort(key=lambda row: (row.get("last_scanned_at") or ""), reverse=True)

    query = (q or "").strip().lower()
    status_key = (status or "").strip()
    if status_key.lower() in {"", "all", "all statuses"}:
        status_key = ""
    filtered = []
    for row in projects:
        if query and query not in row["name"].lower() and query not in row["classifier"].lower():
            continue
        if status_key and row["risk"] != status_key:
            continue
        filtered.append(row)

    visible = filtered
    project_count = len(visible)
    avg = 0.0
    if project_count:
        avg = round(sum(p["compliance_pct"] for p in visible) / project_count, 1)
    compliant_visible = sum(
        1 for p in visible if p.get("component_count", 0) > 0 and float(p.get("compliance_pct") or 0) >= 80.0
    )
    scans_visible = sum(int(p.get("scans") or 0) for p in visible)
    sbom_visible = sum(1 for p in visible if p.get("latest_snapshot_id"))

    return {
        "summary": {
            "project_count": project_count,
            "active_projects": project_count,
            "avg_compliance_pct": avg,
            "compliant_count": compliant_visible,
            "total_count": project_count,
            "total_scans": scans_visible if (query or status_key) else total_scans,
            "sbom_files": sbom_visible if (query or status_key) else sbom_files,
        },
        "projects": visible,
    }


def _project_key(scan: dict[str, Any]) -> str:
    project = str(scan.get("project_id") or "").strip()
    if project:
        return project
    return str(scan.get("application_id") or scan.get("application_name") or "").strip()


def _project_name(scan: dict[str, Any]) -> str:
    project = str(scan.get("project_id") or "").strip()
    if project:
        return project
    return str(scan.get("application_name") or scan.get("application_id") or "Unnamed project").strip()


def _latest_scan(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return max(rows, key=lambda s: s.get("completed_at") or s.get("created_at") or "")


def _empty_stats() -> dict[str, Any]:
    return {
        "vuln_count": 0,
        "vuln_critical": 0,
        "vuln_high": 0,
        "vuln_medium": 0,
        "vuln_low": 0,
        "compliant_components": 0,
        "component_count": 0,
        "compliance_pct": 0.0,
    }


def _snapshot_stats(snap: dict[str, Any]) -> dict[str, Any]:
    matches = (snap.get("raw_metadata") or {}).get("vulnerability_matches") or []
    seen = set()
    critical = 0
    high = 0
    medium = 0
    low = 0
    for match in matches:
        vid = str(match.get("vulnerability_id") or "")
        if not vid or vid in seen:
            continue
        seen.add(vid)
        sev = str(match.get("severity") or "").upper()
        if sev == "CRITICAL":
            critical += 1
        elif sev == "HIGH":
            high += 1
        elif sev == "MEDIUM":
            medium += 1
        elif sev == "LOW":
            low += 1
    comps = snap.get("components") or []
    compliant = 0
    for comp in comps:
        raw = comp.get("raw") or {}
        if raw.get("compliance_pass"):
            compliant += 1
    total = len(comps)
    pct = round((compliant / total) * 100.0, 1) if total else 0.0
    return {
        "vuln_count": len(seen),
        "vuln_critical": critical,
        "vuln_high": high,
        "vuln_medium": medium,
        "vuln_low": low,
        "compliant_components": compliant,
        "component_count": total,
        "compliance_pct": pct,
    }


def _risk(stats: dict[str, Any]) -> str:
    if stats["vuln_critical"] > 0:
        return RISK_HIGH
    if stats["vuln_high"] > 0 or stats["vuln_count"] >= 5:
        return RISK_ATTENTION
    return RISK_HEALTHY


def _tags(sources: list[str], classifier: str) -> list[str]:
    tags = []
    for source in sources:
        if source == "LOCAL":
            tags.append("Local")
        elif source == "GITHUB":
            tags.append("GitHub")
        elif source == "BULK":
            tags.append("Bulk")
        else:
            tags.append(source.title())
    if "Microservice" in classifier and "Microservice" not in tags:
        tags.append("Microservice")
    return tags
