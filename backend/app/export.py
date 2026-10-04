"""CycloneDX, SPDX, CSV, and XLSX exporters."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime

from openpyxl import Workbook


EXPORTERS = {
    "cyclonedx-json": "application/vnd.cyclonedx+json",
    "spdx-json": "application/spdx+json",
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def export_snapshot(fmt: str, snap: dict) -> tuple[bytes, str]:
    if fmt not in EXPORTERS:
        raise KeyError(fmt)
    if fmt == "cyclonedx-json":
        return _cyclonedx(snap), EXPORTERS[fmt]
    if fmt == "spdx-json":
        return _spdx(snap), EXPORTERS[fmt]
    if fmt == "csv":
        return _csv(snap), EXPORTERS[fmt]
    return _xlsx(snap), EXPORTERS[fmt]


def _stamp(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%dT%H:%M:%SZ")
    text = str(value or "")
    if text.endswith("+00:00"):
        text = text[:-6] + "Z"
    return text


def _cyclonedx(snap: dict) -> bytes:
    components = []
    by_id = {}
    for comp in snap.get("components") or []:
        by_id[comp["id"]] = comp.get("purl") or ""
        item = {
            "type": "library",
            "bom-ref": comp.get("purl") or "",
            "name": comp.get("name") or "",
            "version": comp.get("version") or "",
        }
        if comp.get("purl"):
            item["purl"] = comp["purl"]
        if comp.get("cpe"):
            item["cpe"] = comp["cpe"]
        if comp.get("scope"):
            item["scope"] = comp["scope"]
        if comp.get("license"):
            item["licenses"] = [{"license": {"name": comp["license"]}}]
        components.append(item)
    graph: dict[str, list[str]] = {}
    for dep in snap.get("dependencies") or []:
        frm = by_id.get(dep.get("from_component_id"))
        to = by_id.get(dep.get("to_component_id"))
        if frm and to:
            graph.setdefault(frm, []).append(to)
    doc = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "serialNumber": "urn:uuid:" + snap["id"],
        "metadata": {
            "timestamp": _stamp(snap.get("generated_at")),
            "tools": [{"vendor": "bom-engine", "name": snap.get("scanner_name") or "", "version": snap.get("scanner_version") or ""}],
        },
        "components": components,
    }
    if snap.get("application_id"):
        doc["metadata"]["component"] = {
            "type": "application",
            "name": snap["application_id"],
            "version": snap.get("application_version") or "",
        }
    if graph:
        doc["dependencies"] = [{"ref": ref, "dependsOn": deps} for ref, deps in graph.items()]
    return json.dumps(doc, indent=2).encode() + b"\n"


def _or(value, fallback: str) -> str:
    text = (value or "").strip()
    return text or fallback


def _spdx_id(name: str, version: str, index: int) -> str:
    def clean(text: str) -> str:
        return "".join(ch if ch.isalnum() or ch == "-" else "-" for ch in text)

    return f"SPDXRef-Package-{clean(name)}-{clean(version)}-{index}"


def _spdx(snap: dict) -> bytes:
    root_id = "SPDXRef-Package-Root"
    packages = [
        {
            "SPDXID": root_id,
            "name": _or(snap.get("application_id"), "root"),
            "versionInfo": _or(snap.get("application_version"), "NOASSERTION"),
            "downloadLocation": _or(snap.get("repository_url"), "NOASSERTION"),
            "filesAnalyzed": False,
        }
    ]
    rels = [{"spdxElementId": "SPDXRef-DOCUMENT", "relatedSpdxElement": root_id, "relationshipType": "DESCRIBES"}]
    by_id = {}
    for i, comp in enumerate(snap.get("components") or []):
        sid = _spdx_id(comp.get("name") or "", comp.get("version") or "", i)
        by_id[comp["id"]] = sid
        packages.append(
            {
                "SPDXID": sid,
                "name": comp.get("name") or "",
                "versionInfo": _or(comp.get("version"), "NOASSERTION"),
                "downloadLocation": "NOASSERTION",
                "licenseConcluded": _or(comp.get("license"), "NOASSERTION"),
                "licenseDeclared": _or(comp.get("license"), "NOASSERTION"),
                "copyrightText": "NOASSERTION",
                "externalRefs": [
                    {"referenceCategory": "PACKAGE-MANAGER", "referenceType": "purl", "referenceLocator": comp.get("purl") or ""}
                ],
                "filesAnalyzed": False,
            }
        )
        rels.append({"spdxElementId": root_id, "relatedSpdxElement": sid, "relationshipType": "DEPENDS_ON"})
    for dep in snap.get("dependencies") or []:
        frm = by_id.get(dep.get("from_component_id"))
        to = by_id.get(dep.get("to_component_id"))
        if frm and to:
            rels.append({"spdxElementId": frm, "relatedSpdxElement": to, "relationshipType": "DEPENDS_ON"})
    doc = {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": _or(snap.get("application_id"), "sbom"),
        "documentNamespace": "urn:uuid:" + snap["id"],
        "creationInfo": {
            "created": _stamp(snap.get("generated_at")),
            "creators": [f"Tool: {snap.get('scanner_name') or ''}@{snap.get('scanner_version') or ''}"],
        },
        "packages": packages,
        "relationships": rels,
    }
    return json.dumps(doc, indent=2).encode() + b"\n"


def _csv(snap: dict) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "project", "application", "version", "repository", "commit_sha", "commit_author",
            "component", "component_version", "ecosystem", "purl", "license", "scope", "direct", "source_manifest",
        ]
    )
    for comp in snap.get("components") or []:
        writer.writerow(
            [
                snap.get("project_id") or "",
                snap.get("application_id") or "",
                snap.get("application_version") or "",
                snap.get("repository_url") or "",
                snap.get("commit_sha") or "",
                snap.get("commit_author") or "",
                comp.get("name") or "",
                comp.get("version") or "",
                comp.get("ecosystem") or "",
                comp.get("purl") or "",
                comp.get("license") or "",
                comp.get("scope") or "",
                "true" if comp.get("direct") else "false",
                comp.get("source_manifest") or "",
            ]
        )
    return buf.getvalue().encode()


def _vulns(raw) -> list[dict]:
    value = (raw or {}).get("vulnerabilities")
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _xlsx(snap: dict) -> bytes:
    book = Workbook()
    sheet = book.active
    sheet.title = "SBOM"
    headers = [
        "Project", "Application", "Version", "Repository", "Commit SHA", "Commit Author",
        "Component", "Component Version", "PURL", "Vulnerability", "Severity", "CVSS",
        "Fixed Version", "First Detected", "Status",
    ]
    sheet.append(headers)
    first = _stamp(snap.get("generated_at"))[:10]
    for comp in snap.get("components") or []:
        vulns = _vulns(comp.get("raw"))
        if not vulns:
            sheet.append(_row(snap, comp, "", "", "", "", first, "OPEN"))
            continue
        for vuln in vulns:
            sheet.append(
                _row(
                    snap,
                    comp,
                    str(vuln.get("id") or ""),
                    str(vuln.get("severity") or ""),
                    str(vuln.get("cvss") or ""),
                    str(vuln.get("fixed_version") or ""),
                    first,
                    "OPEN",
                )
            )
    cert = book.create_sheet("CERT-In 28-Column SBOM")
    cert.append(
        [
            "Serial Number", "Component Name", "Version", "Ecosystem", "PURL (Package URL)",
            "CPE Identifier", "Supplier / Vendor", "Author / Maintainer", "Description",
            "License Declared", "License Concluded", "Download Location", "Source Manifest Path",
            "Direct or Transitive Dependency", "Dependency Depth", "Declared Dependencies Count",
            "Resolved Children Count", "Hash SHA-1", "Hash SHA-256", "Hash SHA-512",
            "Vulnerabilities Count", "Critical Severity Count", "High Severity Count",
            "Medium Severity Count", "Low Severity Count", "Max CVSS v3 Score",
            "Is End-of-Life (EOL)", "Compliance Pass/Fail Status",
        ]
    )
    for index, comp in enumerate(snap.get("components") or [], start=1):
        cert.append(_cert_row(index, comp))
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


def _row(snap, comp, vuln, sev, cvss, fixed, first, status):
    return [
        snap.get("project_id") or "",
        snap.get("application_id") or "",
        snap.get("application_version") or "",
        snap.get("repository_url") or "",
        snap.get("commit_sha") or "",
        snap.get("commit_author") or "",
        comp.get("name") or "",
        comp.get("version") or "",
        comp.get("purl") or "",
        vuln,
        sev,
        cvss,
        fixed,
        first,
        status,
    ]


def _field(raw: dict, key: str) -> str:
    value = raw.get(key)
    return value if isinstance(value, str) and value else "NOASSERTION"


def _cert_row(serial: int, comp: dict) -> list:
    raw = comp.get("raw") or {}
    hashes = raw.get("hashes") if isinstance(raw.get("hashes"), dict) else {}
    if not hashes.get("SHA-256") and comp.get("hash"):
        hashes = dict(hashes)
        hashes["SHA-256"] = comp["hash"]
    declared = raw.get("declared_sub_dependencies") if isinstance(raw.get("declared_sub_dependencies"), list) else []
    vulns = _vulns(raw)

    def count(level: str) -> int:
        return sum(1 for item in vulns if str(item.get("severity") or "").upper() == level)

    max_cvss = 0.0
    for item in vulns:
        score = item.get("cvss")
        if isinstance(score, (int, float)) and score > max_cvss:
            max_cvss = float(score)
    return [
        serial,
        comp.get("name") or "",
        comp.get("version") or "",
        comp.get("ecosystem") or "",
        comp.get("purl") or "",
        comp.get("cpe") or "",
        comp.get("supplier") or "",
        _field(raw, "author"),
        _field(raw, "description"),
        comp.get("license") or "",
        comp.get("license") or "",
        _field(raw, "download_location"),
        comp.get("source_manifest") or "",
        "direct" if comp.get("direct") else "transitive",
        raw.get("depth"),
        len(declared),
        raw.get("resolved_children_count", len(declared)),
        hashes.get("SHA-1") or "",
        hashes.get("SHA-256") or "",
        hashes.get("SHA-512") or "",
        len(vulns),
        count("CRITICAL"),
        count("HIGH"),
        count("MEDIUM"),
        count("LOW"),
        max_cvss,
        bool(raw.get("eol")),
        "Pass" if raw.get("compliance_pass") else "Fail",
    ]
