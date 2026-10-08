"""Findings, NTIA checks, and dependency ids stored on the ten-table schema.

Snapshot reads still return the dictionaries the API already uses.
"""

from __future__ import annotations

import uuid
from typing import Any

_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"}
_CHECKS = (
    "ntia_supplier",
    "ntia_name",
    "ntia_version",
    "ntia_identifier",
    "ntia_relationship",
    "ntia_author",
    "ntia_timestamp",
)


def resolve_catalog_ids(
    db,
    organization_id: str,
    project_name: str,
    application_name: str,
) -> tuple[str | None, str | None]:
    """Map the names stored on a scan to project and application ids."""
    project_name = (project_name or "").strip()
    application_name = (application_name or "").strip()
    if not (organization_id or "").strip() or not project_name:
        return None, None
    row = db.execute(
        """SELECT p.id AS project_id, a.id AS application_id
           FROM projects p
           LEFT JOIN applications a
             ON a.project_id = p.id
            AND a.organization_id = p.organization_id
            AND a.name = ?
           WHERE p.organization_id = ? AND p.name = ?""",
        (application_name, organization_id, project_name),
    ).fetchone()
    if row is None:
        return None, None
    return row["project_id"], row["application_id"]


def stored_metadata(raw: dict | None) -> dict:
    """Metadata saved on the SBOM. Matches live in findings."""
    data = dict(raw or {})
    data.pop("vulnerability_matches", None)
    return data


def stored_component_raw(raw: dict | None) -> dict:
    """Component JSON that is not stored in findings or NTIA columns."""
    data = dict(raw or {})
    data.pop("vulnerabilities", None)
    data.pop("compliance_status", None)
    data.pop("compliance_pass", None)
    return data


def persist_snapshot_facts(db, snap: dict[str, Any], components: list[dict[str, Any]]) -> None:
    """Write findings, NTIA flags, depth, and dependency ids for one SBOM."""
    sbom_id = snap["id"]
    project_id, application_id = resolve_catalog_ids(
        db,
        str(snap.get("organization_id") or ""),
        str(snap.get("project_id") or ""),
        str(snap.get("application_id") or ""),
    )
    db.execute(
        """UPDATE sboms
           SET catalog_project_id = ?, catalog_application_id = ?, facts_normalized = TRUE
           WHERE id = ?""",
        (project_id, application_id, sbom_id),
    )
    kept = {comp["id"] for comp in components}
    children: dict[str, list[str]] = {}
    for dep in snap.get("dependencies") or []:
        source = str(dep.get("from_component_id") or "")
        target = str(dep.get("to_component_id") or "")
        if source in kept and target in kept:
            children.setdefault(source, []).append(target)
    for comp in components:
        raw = comp.get("raw") if isinstance(comp.get("raw"), dict) else {}
        status = raw.get("compliance_status") if isinstance(raw.get("compliance_status"), dict) else {}
        flags = [status.get(code) if isinstance(status.get(code), bool) else None for code in _CHECKS]
        db.execute(
            """UPDATE sbom_components
               SET dependency_depth = COALESCE(?, dependency_depth),
                   depends_on = ?,
                   ntia_supplier = ?, ntia_name = ?, ntia_version = ?, ntia_identifier = ?,
                   ntia_relationship = ?, ntia_author = ?, ntia_timestamp = ?
               WHERE id = ?""",
            (_depth(raw), children.get(comp["id"]) or [], *flags, comp["id"]),
        )
    _persist_findings(db, sbom_id, kept, snap.get("raw_metadata") or {})


def overlay_snapshot_facts(db, snap: dict[str, Any]) -> None:
    """Fill match and compliance dictionaries from findings and NTIA columns."""
    findings = db.execute(
        """SELECT f.sbom_component_id, v.vulnerability_key, v.reference_urls, f.source, f.severity,
                  f.cvss_score, f.cvss_vector, f.description, f.fixed_version
           FROM findings f
           JOIN vulnerabilities v ON v.id = f.vulnerability_id
           WHERE f.sbom_id = ?
           ORDER BY v.vulnerability_key""",
        (snap["id"],),
    ).fetchall()
    matches = []
    attached: dict[str, list[dict[str, Any]]] = {}
    for row in findings:
        score = float(row["cvss_score"] or 0)
        urls = [url for url in (row["reference_urls"] or []) if url]
        record = {
            "component_id": row["sbom_component_id"],
            "vulnerability_id": row["vulnerability_key"],
            "source": row["source"] or "",
            "severity": row["severity"] or "UNKNOWN",
            "cvss_score": score,
            "cvss_vector": row["cvss_vector"] or "",
            "description": row["description"] or "",
            "fixed_version": row["fixed_version"] or "",
        }
        if urls:
            record["references"] = urls
        matches.append(record)
        attached.setdefault(row["sbom_component_id"], []).append(
            {
                "id": record["vulnerability_id"],
                "severity": record["severity"],
                "cvss": score,
                "fixed_version": record["fixed_version"],
                "source": record["source"],
            }
        )
    metadata = dict(snap.get("raw_metadata") or {})
    metadata["vulnerability_matches"] = matches
    snap["raw_metadata"] = metadata
    flags = db.execute(
        """SELECT id, ntia_supplier, ntia_name, ntia_version, ntia_identifier,
                  ntia_relationship, ntia_author, ntia_timestamp
           FROM sbom_components WHERE sbom_id = ?""",
        (snap["id"],),
    ).fetchall()
    by_id = {row["id"]: row for row in flags}
    for comp in snap.get("components") or []:
        raw = dict(comp.get("raw") or {})
        if comp["id"] in attached:
            raw["vulnerabilities"] = attached[comp["id"]]
        row = by_id.get(comp["id"])
        if row is not None:
            status = {}
            for code in _CHECKS:
                if row[code] is not None:
                    status[code] = bool(row[code])
            if status:
                raw["compliance_status"] = status
                raw["compliance_pass"] = all(status.values())
        if raw:
            comp["raw"] = raw


def _persist_findings(db, sbom_id: str, kept: set[str], metadata: dict) -> None:
    seen: set[tuple[str, str]] = set()
    for match in metadata.get("vulnerability_matches") or []:
        if not isinstance(match, dict):
            continue
        component_id = str(match.get("component_id") or "")
        key = str(match.get("vulnerability_id") or "").strip().upper()[:128]
        if not component_id or component_id not in kept or not key or (component_id, key) in seen:
            continue
        seen.add((component_id, key))
        vulnerability_id = _upsert_vulnerability(db, key, match)
        db.execute(
            """INSERT INTO findings (
                 id, sbom_id, sbom_component_id, vulnerability_id, source, severity,
                 cvss_score, cvss_vector, description, fixed_version)
               VALUES (?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT (sbom_component_id, vulnerability_id) DO NOTHING""",
            (
                str(uuid.uuid4()),
                sbom_id,
                component_id,
                vulnerability_id,
                str(match.get("source") or "")[:40],
                _severity(match.get("severity")),
                _score(match.get("cvss_score")),
                str(match.get("cvss_vector") or "")[:200],
                str(match.get("description") or "")[:8000],
                str(match.get("fixed_version") or "")[:100],
            ),
        )


def _upsert_vulnerability(db, key: str, match: dict) -> str:
    urls = [str(url).strip()[:2000] for url in (match.get("references") or []) if str(url or "").strip()]
    db.execute(
        """INSERT INTO vulnerabilities (
             id, vulnerability_key, source, severity, cvss_score, cvss_vector, description, reference_urls)
           VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT (vulnerability_key) DO UPDATE
           SET source = CASE WHEN EXCLUDED.source <> '' THEN EXCLUDED.source ELSE vulnerabilities.source END,
               severity = CASE
                 WHEN EXCLUDED.severity <> 'UNKNOWN' THEN EXCLUDED.severity
                 ELSE vulnerabilities.severity END,
               cvss_score = CASE
                 WHEN EXCLUDED.cvss_score > 0 THEN EXCLUDED.cvss_score
                 ELSE vulnerabilities.cvss_score END,
               cvss_vector = CASE
                 WHEN EXCLUDED.cvss_vector <> '' THEN EXCLUDED.cvss_vector
                 ELSE vulnerabilities.cvss_vector END,
               description = CASE
                 WHEN EXCLUDED.description <> '' THEN EXCLUDED.description
                 ELSE vulnerabilities.description END,
               reference_urls = CASE
                 WHEN cardinality(EXCLUDED.reference_urls) > 0 THEN EXCLUDED.reference_urls
                 ELSE vulnerabilities.reference_urls END,
               updated_at = CURRENT_TIMESTAMP""",
        (
            str(uuid.uuid4()),
            key,
            str(match.get("source") or "")[:40],
            _severity(match.get("severity")),
            _score(match.get("cvss_score")),
            str(match.get("cvss_vector") or "")[:200],
            str(match.get("description") or "")[:8000],
            urls,
        ),
    )
    row = db.execute(
        "SELECT id FROM vulnerabilities WHERE vulnerability_key = ?",
        (key,),
    ).fetchone()
    if row is None:
        raise RuntimeError("vulnerability could not be saved")
    return row["id"]


def _severity(value: Any) -> str:
    upper = str(value or "").strip().upper()
    if upper in _SEVERITIES:
        return upper
    return "UNKNOWN"


def _score(value: Any) -> float:
    try:
        score = float(value or 0)
    except (TypeError, ValueError):
        return 0.0
    if score < 0:
        return 0.0
    if score > 10:
        return 10.0
    return round(score, 1)


def _depth(raw: Any) -> int | None:
    if not isinstance(raw, dict) or "depth" not in raw or isinstance(raw.get("depth"), bool):
        return None
    try:
        depth = int(raw["depth"])
    except (TypeError, ValueError):
        return None
    if depth < 0:
        return None
    return depth
