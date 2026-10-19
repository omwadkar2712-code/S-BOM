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


def normalize_format(fmt: str) -> str:
    cleaned = (fmt or "").lower().strip()
    if cleaned in ("spdx", "spdx-json", "spdx_json"):
        return "spdx-json"
    if cleaned in ("cyclonedx", "cyclonedx-json", "cyclonedx_json", "cdx", "cdx-json"):
        return "cyclonedx-json"
    if cleaned in ("csv", "text/csv"):
        return "csv"
    if cleaned in ("xlsx", "excel"):
        return "xlsx"
    return cleaned


def export_snapshot(fmt: str, snap: dict) -> tuple[bytes, str]:
    fmt = normalize_format(fmt)
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
    root_name = snap.get("application_id") or snap.get("project_id") or "application"
    root_version = snap.get("application_version") or "1.0.0"
    root_ref = f"root-{root_name}"

    for comp in snap.get("components") or []:
        comp_id = str(comp.get("id") or comp.get("purl") or comp.get("name") or "")
        bom_ref = comp.get("purl") or (f"comp-{comp_id}" if comp_id else f"comp-{len(components)}")
        by_id[comp_id] = bom_ref
        item = {
            "type": "library",
            "bom-ref": bom_ref,
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
        raw = comp.get("raw") or {}
        hashes = raw.get("hashes") if isinstance(raw.get("hashes"), dict) else {}
        h_list = []
        sha256 = comp.get("hash") or hashes.get("SHA-256")
        if sha256:
            h_list.append({"alg": "SHA-256", "content": sha256})
        if hashes.get("SHA-1"):
            h_list.append({"alg": "SHA-1", "content": hashes.get("SHA-1")})
        if hashes.get("SHA-512"):
            h_list.append({"alg": "SHA-512", "content": hashes.get("SHA-512")})
        if h_list:
            item["hashes"] = h_list
        if comp.get("supplier"):
            item["supplier"] = {"name": comp["supplier"]}
        if raw.get("description"):
            item["description"] = raw["description"]
        components.append(item)

    # Extract vulnerability findings for standard CycloneDX 1.5 vulnerabilities element
    vulnerabilities = []
    vuln_matches = (snap.get("raw_metadata") or {}).get("vulnerability_matches") or []
    if not vuln_matches:
        for comp in snap.get("components") or []:
            for v in (comp.get("raw") or {}).get("vulnerabilities") or []:
                vuln_matches.append({
                    "component_id": comp.get("id"),
                    "vulnerability_id": v.get("id"),
                    "severity": v.get("severity"),
                    "cvss_score": v.get("cvss"),
                    "fixed_version": v.get("fixed_version"),
                    "source": v.get("source"),
                })
    seen_vulns = set()
    for idx, vm in enumerate(vuln_matches):
        vid = str(vm.get("vulnerability_id") or "").strip()
        cid = str(vm.get("component_id") or "")
        affects_ref = by_id.get(cid) or cid
        vkey = f"{vid}|{affects_ref}"
        if not vid or vkey in seen_vulns:
            continue
        seen_vulns.add(vkey)
        sev = str(vm.get("severity") or "UNKNOWN").upper()
        cvss = float(vm.get("cvss_score") or 0)
        vulnerabilities.append({
            "bom-ref": f"vuln-{vid}-{idx}",
            "id": vid,
            "source": {"name": str(vm.get("source") or "NVD")},
            "ratings": [
                {
                    "source": {"name": str(vm.get("source") or "NVD")},
                    "score": cvss,
                    "severity": sev.lower() if sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW") else "unknown",
                    "method": "CVSSv31",
                    "vector": str(vm.get("cvss_vector") or ""),
                }
            ],
            "description": str(vm.get("description") or f"Vulnerability {vid}"),
            "affects": [{"ref": affects_ref}],
        })

    graph: dict[str, list[str]] = {}
    for dep in snap.get("dependencies") or []:
        frm = by_id.get(dep.get("from_component_id"))
        to = by_id.get(dep.get("to_component_id"))
        if frm and to:
            graph.setdefault(frm, []).append(to)
    if not graph and components:
        graph[root_ref] = [c["bom-ref"] for c in components]

    snap_id = str(snap.get("id") or "00000000-0000-0000-0000-000000000000")
    doc = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "serialNumber": "urn:uuid:" + snap_id,
        "metadata": {
            "timestamp": _stamp(snap.get("generated_at")),
            "tools": {
                "components": [
                    {
                        "type": "application",
                        "name": snap.get("scanner_name") or "S-BOM-Engine",
                        "version": snap.get("scanner_version") or "1.5.0",
                    }
                ]
            },
            "component": {
                "bom-ref": root_ref,
                "type": "application",
                "name": root_name,
                "version": root_version,
            },
        },
        "components": components,
    }
    if vulnerabilities:
        doc["vulnerabilities"] = vulnerabilities
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
    root_name = _or(snap.get("application_id") or snap.get("project_id"), "root")
    root_ver = _or(snap.get("application_version"), "1.0.0")
    packages = [
        {
            "SPDXID": root_id,
            "name": root_name,
            "versionInfo": root_ver,
            "downloadLocation": _or(snap.get("repository_url"), "NOASSERTION"),
            "filesAnalyzed": False,
            "licenseConcluded": "NOASSERTION",
            "licenseDeclared": "NOASSERTION",
            "copyrightText": "NOASSERTION",
        }
    ]
    rels = [{"spdxElementId": "SPDXRef-DOCUMENT", "relatedSpdxElement": root_id, "relationshipType": "DESCRIBES"}]
    by_id = {}
    for i, comp in enumerate(snap.get("components") or []):
        sid = _spdx_id(comp.get("name") or "", comp.get("version") or "", i)
        comp_id = str(comp.get("id") or str(i))
        by_id[comp_id] = sid
        pkg_obj = {
            "SPDXID": sid,
            "name": comp.get("name") or f"component-{i}",
            "versionInfo": _or(comp.get("version"), "NOASSERTION"),
            "downloadLocation": "NOASSERTION",
            "licenseConcluded": _or(comp.get("license"), "NOASSERTION"),
            "licenseDeclared": _or(comp.get("license"), "NOASSERTION"),
            "copyrightText": "NOASSERTION",
            "filesAnalyzed": False,
        }
        ext_refs = []
        if comp.get("purl"):
            ext_refs.append(
                {"referenceCategory": "PACKAGE-MANAGER", "referenceType": "purl", "referenceLocator": comp["purl"]}
            )
        if comp.get("cpe"):
            ext_refs.append(
                {"referenceCategory": "SECURITY", "referenceType": "cpe23Type", "referenceLocator": comp["cpe"]}
            )
        if ext_refs:
            pkg_obj["externalRefs"] = ext_refs
        if comp.get("supplier"):
            pkg_obj["supplier"] = f"Organization: {comp['supplier']}"
        raw = comp.get("raw") or {}
        hashes = raw.get("hashes") if isinstance(raw.get("hashes"), dict) else {}
        sha256 = comp.get("hash") or hashes.get("SHA-256")
        if sha256:
            pkg_obj["checksums"] = [{"algorithm": "SHA256", "checksumValue": sha256}]
        packages.append(pkg_obj)
        rels.append({"spdxElementId": root_id, "relatedSpdxElement": sid, "relationshipType": "DEPENDS_ON"})

    for dep in snap.get("dependencies") or []:
        frm = by_id.get(dep.get("from_component_id"))
        to = by_id.get(dep.get("to_component_id"))
        if frm and to:
            rels.append({"spdxElementId": frm, "relatedSpdxElement": to, "relationshipType": "DEPENDS_ON"})

    snap_id = str(snap.get("id") or "00000000-0000-0000-0000-000000000000")
    clean_name = "".join(c if c.isalnum() or c in "-_." else "-" for c in root_name)
    doc = {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": root_name,
        "documentNamespace": f"https://spdx.org/spdxdocs/{clean_name}-{snap_id}",
        "creationInfo": {
            "created": _stamp(snap.get("generated_at")),
            "creators": [
                f"Tool: {snap.get('scanner_name') or 'S-BOM-Engine'}-{snap.get('scanner_version') or '1.5.0'}",
                "Organization: Security Operations",
            ],
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
