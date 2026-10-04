"""SBOM scan: detect manifests, parse, dedupe, graph, and local enrichment."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from . import parsers
from .detector import detect
from .vuln import query_version

SPDX_ALIASES = {
    "mit": "MIT",
    "mit license": "MIT",
    "apache 2.0": "Apache-2.0",
    "apache-2.0": "Apache-2.0",
    "apache license 2.0": "Apache-2.0",
    "gplv3": "GPL-3.0-only",
    "gpl-3.0": "GPL-3.0-only",
    "gpl-3.0-only": "GPL-3.0-only",
    "gnu gpl v3": "GPL-3.0-only",
    "bsd 3-clause": "BSD-3-Clause",
    "bsd-3-clause": "BSD-3-Clause",
    "isc": "ISC",
    "mpl-2.0": "MPL-2.0",
}


def scan_tree(root: str, scanner_version: str, scan_installed: bool = False) -> dict:
    manifests, notes = detect(root, scan_installed=scan_installed)
    snap = {
        "id": str(uuid.uuid4()),
        "scanner_name": "sbom",
        "scanner_version": scanner_version or "0.0.0-dev",
        "bom_format_version": "1.5",
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0),
        "bom_type": "SBOM",
        "components": [],
        "dependencies": [],
        "raw_metadata": {
            "manifests_detected": len(manifests),
            "skipped_oversized": notes.skipped_oversized,
            "unreadable_paths": notes.unreadable,
            "scan_truncated": notes.truncated,
            "pipeline": ["crawl", "parse", "dedupe", "graph", "enrich", "compliance"],
        },
    }
    for manifest in manifests:
        try:
            parsed = parsers.parse_manifest(manifest.kind, manifest.path, manifest.rel)
        except Exception as exc:  # a bad manifest is recorded, not fatal
            errors = snap["raw_metadata"].setdefault("parse_errors", [])
            errors.append({"manifest": manifest.rel, "error": str(exc)})
            continue
        snap["components"].extend(parsed.get("components") or [])
        snap["dependencies"].extend(parsed.get("dependencies") or [])
    snap["components"], snap["dependencies"] = dedupe(snap["components"], snap["dependencies"])
    apply_graph(snap["components"], snap["dependencies"])
    enrich_local(snap["components"], root)
    audit_compliance(snap["components"], snap["dependencies"], snap["scanner_name"], True)
    for comp in snap["components"]:
        comp["bom_snapshot_id"] = snap["id"]
    for dep in snap["dependencies"]:
        dep["bom_snapshot_id"] = snap["id"]
        if not dep.get("id"):
            dep["id"] = str(uuid.uuid4())
    return snap


def dedupe(comps: list[dict], deps: list[dict]) -> tuple[list[dict], list[dict]]:
    seen: dict[tuple[str, str, str], int] = {}
    id_map: dict[str, str] = {}
    out: list[dict] = []
    for comp in comps:
        key = (comp.get("name", "").lower(), comp.get("version", ""), str(comp.get("ecosystem", "")).lower())
        if key in seen:
            merge_component(out[seen[key]], comp)
            if comp.get("id") and out[seen[key]].get("id"):
                id_map[comp["id"]] = out[seen[key]]["id"]
            continue
        seen[key] = len(out)
        out.append(comp)
    out, dropped = _prefer_resolved_version(out)
    id_map.update(dropped)
    if not id_map:
        return out, deps
    edge_seen = set()
    dout = []
    for dep in deps:
        frm = id_map.get(dep["from_component_id"], dep["from_component_id"])
        to = id_map.get(dep["to_component_id"], dep["to_component_id"])
        ek = f"{frm}>{to}:{dep.get('kind') or ''}"
        if ek in edge_seen:
            continue
        edge_seen.add(ek)
        dep = dict(dep)
        dep["from_component_id"] = frm
        dep["to_component_id"] = to
        dout.append(dep)
    return out, dout


def _prefer_resolved_version(comps: list[dict]) -> tuple[list[dict], dict[str, str]]:
    """Keep the lockfile version when the same package was also declared without one."""
    groups: dict[tuple[str, str], list[dict]] = {}
    for comp in comps:
        key = (str(comp.get("name") or "").lower(), str(comp.get("ecosystem") or "").lower())
        groups.setdefault(key, []).append(comp)
    kept: list[dict] = []
    dropped: dict[str, str] = {}
    for group in groups.values():
        resolved = [comp for comp in group if query_version(str(comp.get("version") or ""))]
        if not resolved or len(resolved) == len(group):
            kept.extend(group)
            continue
        primary = resolved[0]
        for comp in group:
            if comp in resolved:
                continue
            if comp.get("direct"):
                primary["direct"] = True
            merge_component(primary, comp)
            if comp.get("id") and primary.get("id"):
                dropped[comp["id"]] = primary["id"]
        kept.extend(resolved)
    return kept, dropped


def merge_component(dst: dict, src: dict) -> None:
    for field in ("license", "supplier", "cpe", "hash", "purl", "source_manifest"):
        if _blank(dst.get(field)) and src.get(field):
            dst[field] = src[field]
    if not dst.get("direct") and src.get("direct"):
        dst["direct"] = True
    dst.setdefault("raw", {})
    src.setdefault("raw", {})
    dst["raw"]["hashes"] = _union_map(dst["raw"].get("hashes"), src["raw"].get("hashes"))
    dst["raw"]["declared_sub_dependencies"] = _union_list(
        dst["raw"].get("declared_sub_dependencies"), src["raw"].get("declared_sub_dependencies")
    )
    depths = [d for d in (dst["raw"].get("depth"), src["raw"].get("depth")) if isinstance(d, int)]
    if depths:
        dst["raw"]["depth"] = min(depths)


def _blank(value) -> bool:
    return not value or value == "NOASSERTION"


def _union_map(a, b) -> dict | None:
    left = a if isinstance(a, dict) else {}
    right = b if isinstance(b, dict) else {}
    if not left and not right:
        return None
    out = dict(left)
    for key, value in right.items():
        out.setdefault(key, value)
    return out


def _union_list(a, b) -> list:
    seen = set()
    out = []
    for item in list(a or []) + list(b or []):
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def apply_graph(comps: list[dict], deps: list[dict]) -> None:
    if not comps:
        return
    by_id = {}
    incoming: dict[str, int] = {}
    children: dict[str, list[str]] = {}
    for comp in comps:
        by_id[comp["id"]] = comp
        comp.setdefault("raw", {})
        comp["raw"]["depth"] = 1
        comp["raw"]["component_id"] = component_key(comp)
    for dep in deps:
        frm, to = dep.get("from_component_id"), dep.get("to_component_id")
        if not frm or not to or frm not in by_id or to not in by_id:
            continue
        children.setdefault(frm, []).append(to)
        incoming[to] = incoming.get(to, 0) + 1
    roots = [comp["id"] for comp in comps if comp.get("direct")]
    if not roots:
        for comp in comps:
            if incoming.get(comp["id"], 0) == 0:
                comp["direct"] = True
                roots.append(comp["id"])
    best: dict[str, int] = {}

    def dfs(node: str, depth: int, stack: set[str]) -> None:
        if node in stack:
            return
        if node in best and best[node] <= depth:
            return
        best[node] = depth
        comp = by_id.get(node)
        if comp is not None:
            comp.setdefault("raw", {})["depth"] = depth
            comp["direct"] = depth < 2
        stack.add(node)
        for child in children.get(node, []):
            dfs(child, depth + 1, stack)
        stack.discard(node)

    for root in roots:
        dfs(root, 1, set())


def enrich_local(comps: list[dict], root: str) -> None:
    license_cache: dict[str, str] = {}
    root_path = Path(root) if root else None
    for comp in comps:
        comp.setdefault("raw", {})
        if not comp.get("purl") and comp.get("name") and comp.get("version"):
            comp["purl"] = f"pkg:{comp.get('ecosystem')}/{comp['name']}@{comp['version']}"
        if comp.get("license"):
            comp["license"] = normalize_license(comp["license"])
        elif root_path and comp.get("source_manifest"):
            directory = str((root_path / comp["source_manifest"]).parent)
            if directory not in license_cache:
                license_cache[directory] = license_file(Path(directory))
            if license_cache[directory]:
                comp["license"] = license_cache[directory]
        if not comp.get("supplier"):
            comp["supplier"] = "NOASSERTION"
        if not comp["raw"].get("description"):
            comp["raw"]["description"] = "NOASSERTION"
        hashes = {}
        existing = comp["raw"].get("hashes")
        if isinstance(existing, dict):
            hashes.update({k: v for k, v in existing.items() if isinstance(v, str)})
        if comp.get("hash"):
            algo = "SHA-256"
            lower = comp["hash"].lower()
            if lower.startswith("sha512-"):
                algo = "SHA-512"
            elif lower.startswith("sha1-"):
                algo = "SHA-1"
            elif lower.startswith("md5-"):
                algo = "MD5"
            hashes[algo] = comp["hash"]
        if hashes:
            comp["raw"]["hashes"] = hashes
        comp["raw"]["component_id"] = component_key(comp)


def audit_compliance(comps: list[dict], deps: list[dict], author: str, has_timestamp: bool) -> None:
    linked = set()
    for dep in deps:
        linked.add(dep.get("from_component_id"))
        linked.add(dep.get("to_component_id"))
    for comp in comps:
        comp.setdefault("raw", {})
        supplier_ok = bool(comp.get("supplier")) and comp.get("supplier") != "NOASSERTION"
        status = {
            "ntia_supplier": supplier_ok,
            "ntia_name": bool(comp.get("name")),
            "ntia_version": bool(comp.get("version")),
            "ntia_identifier": bool(comp.get("purl") or comp.get("cpe")),
            "ntia_relationship": bool(comp.get("direct") or comp.get("id") in linked),
            "ntia_author": bool(author),
            "ntia_timestamp": has_timestamp,
        }
        comp["raw"]["compliance_status"] = status
        comp["raw"]["compliance_pass"] = all(status.values())


def component_key(comp: dict) -> str:
    return f"{str(comp.get('name') or '').lower()}@{comp.get('version') or ''}:{str(comp.get('ecosystem') or '').lower()}"


def normalize_license(value: str) -> str:
    key = " ".join(value.strip().lower().split())
    return SPDX_ALIASES.get(key, value)


def license_file(directory: Path) -> str:
    for name in ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "NOTICE"):
        path = directory / name
        if not path.is_file():
            continue
        text = path.read_bytes()[: 64 * 1024].decode("utf-8", "replace").lower()
        if "mit license" in text:
            return "MIT"
        if "apache license" in text:
            return "Apache-2.0"
        if "gnu general public license" in text and "version 3" in text:
            return "GPL-3.0-only"
        if "bsd 3-clause" in text or "redistribution and use" in text:
            return "BSD-3-Clause"
    return ""


def normalize(snap: dict) -> None:
    seen: dict[str, int] = {}
    out = []
    for comp in snap.get("components") or []:
        comp["ecosystem"] = str(comp.get("ecosystem") or "").lower()
        if not comp.get("purl") and comp.get("name") and comp.get("version"):
            comp["purl"] = f"pkg:{comp['ecosystem']}/{comp['name']}@{comp['version']}"
        key = f"{comp['ecosystem']}|{comp.get('name')}|{comp.get('version')}"
        if key in seen:
            if not out[seen[key]].get("direct") and comp.get("direct"):
                out[seen[key]]["direct"] = True
            continue
        seen[key] = len(out)
        out.append(comp)
    out.sort(key=lambda c: (c.get("ecosystem") or "", c.get("name") or "", c.get("version") or ""))
    snap["components"] = out
