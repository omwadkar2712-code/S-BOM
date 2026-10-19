"""Unit tests for JSON manifest parsing, CycloneDX/SPDX compliance, and status validation."""

import json
from pathlib import Path
from app.scanner.detector import match_file
from app.scanner.parsers import parse_manifest
from app.export.formats import export_snapshot


def test_json_file_detection():
    # Any .json file should be detected as a manifest
    assert match_file("package.json")[0] == "NODE_PACKAGE_JSON"
    assert match_file("sbom.json")[0] == "JSON_MANIFEST"
    assert match_file("cyclonedx.json")[0] == "JSON_MANIFEST"
    assert match_file("spdx.json")[0] == "JSON_MANIFEST"
    assert match_file("custom.json")[0] == "JSON_MANIFEST"


def test_cyclonedx_json_parsing(tmp_path: Path):
    cdx_data = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "components": [
            {
                "type": "library",
                "name": "express",
                "version": "4.18.2",
                "purl": "pkg:npm/express@4.18.2",
                "licenses": [{"license": {"id": "MIT"}}],
                "hashes": [{"alg": "SHA-256", "content": "abcdef1234567890"}],
            },
            {
                "type": "library",
                "name": "requests",
                "version": "2.31.0",
                "purl": "pkg:pypi/requests@2.31.0",
                "licenses": [{"license": {"id": "Apache-2.0"}}],
            },
        ],
    }
    file_path = tmp_path / "cyclonedx.json"
    file_path.write_text(json.dumps(cdx_data), encoding="utf-8")

    parsed = parse_manifest("JSON_MANIFEST", file_path, "cyclonedx.json")
    comps = parsed["components"]
    assert len(comps) == 2
    assert comps[0]["name"] == "express"
    assert comps[0]["version"] == "4.18.2"
    assert comps[0]["ecosystem"] == "npm"
    assert comps[0]["license"] == "MIT"
    assert comps[0]["hash"] == "abcdef1234567890"

    assert comps[1]["name"] == "requests"
    assert comps[1]["version"] == "2.31.0"
    assert comps[1]["ecosystem"] == "pypi"
    assert comps[1]["license"] == "Apache-2.0"


def test_spdx_json_parsing(tmp_path: Path):
    spdx_data = {
        "spdxVersion": "SPDX-2.3",
        "SPDXID": "SPDXRef-DOCUMENT",
        "packages": [
            {
                "SPDXID": "SPDXRef-Package-Root",
                "name": "root-app",
                "versionInfo": "1.0.0",
            },
            {
                "SPDXID": "SPDXRef-Package-lodash",
                "name": "lodash",
                "versionInfo": "4.17.21",
                "licenseConcluded": "MIT",
                "externalRefs": [
                    {
                        "referenceCategory": "PACKAGE-MANAGER",
                        "referenceType": "purl",
                        "referenceLocator": "pkg:npm/lodash@4.17.21",
                    }
                ],
            },
        ],
    }
    file_path = tmp_path / "spdx.json"
    file_path.write_text(json.dumps(spdx_data), encoding="utf-8")

    parsed = parse_manifest("JSON_MANIFEST", file_path, "spdx.json")
    comps = parsed["components"]
    assert len(comps) == 1
    assert comps[0]["name"] == "lodash"
    assert comps[0]["version"] == "4.17.21"
    assert comps[0]["ecosystem"] == "npm"
    assert comps[0]["license"] == "MIT"


def test_cyclonedx_export_compliance():
    snap = {
        "id": "11111111-2222-3333-4444-555555555555",
        "application_id": "payment-service",
        "application_version": "2.1.0",
        "generated_at": "2026-10-19T09:00:00Z",
        "components": [
            {
                "id": "c1",
                "name": "axios",
                "version": "1.5.0",
                "purl": "pkg:npm/axios@1.5.0",
                "license": "MIT",
                "hash": "aabbccddeeff",
            }
        ],
        "dependencies": [],
        "raw_metadata": {
            "vulnerability_matches": [
                {
                    "component_id": "c1",
                    "vulnerability_id": "CVE-2023-45857",
                    "severity": "HIGH",
                    "cvss_score": 7.5,
                    "description": "Prototype pollution in axios",
                }
            ]
        },
    }
    raw, mime = export_snapshot("cyclonedx-json", snap)
    assert mime == "application/vnd.cyclonedx+json"
    doc = json.loads(raw.decode("utf-8"))
    assert doc["bomFormat"] == "CycloneDX"
    assert doc["specVersion"] == "1.5"
    assert doc["serialNumber"].startswith("urn:uuid:")
    assert doc["metadata"]["component"]["name"] == "payment-service"
    assert doc["metadata"]["component"]["bom-ref"] == "root-payment-service"
    assert len(doc["components"]) == 1
    assert doc["components"][0]["name"] == "axios"
    assert doc["components"][0]["bom-ref"] == "pkg:npm/axios@1.5.0"
    assert doc["components"][0]["hashes"][0]["content"] == "aabbccddeeff"
    assert "vulnerabilities" in doc
    assert len(doc["vulnerabilities"]) == 1
    assert doc["vulnerabilities"][0]["id"] == "CVE-2023-45857"
    assert doc["vulnerabilities"][0]["affects"][0]["ref"] == "pkg:npm/axios@1.5.0"


def test_spdx_export_compliance():
    snap = {
        "id": "11111111-2222-3333-4444-555555555555",
        "application_id": "auth-service",
        "application_version": "1.0.0",
        "generated_at": "2026-10-19T09:00:00Z",
        "components": [
            {
                "id": "c2",
                "name": "jsonwebtoken",
                "version": "9.0.0",
                "purl": "pkg:npm/jsonwebtoken@9.0.0",
                "license": "MIT",
            }
        ],
        "dependencies": [],
    }
    raw, mime = export_snapshot("spdx-json", snap)
    assert mime == "application/spdx+json"
    doc = json.loads(raw.decode("utf-8"))
    assert doc["spdxVersion"] == "SPDX-2.3"
    assert doc["dataLicense"] == "CC0-1.0"
    assert doc["SPDXID"] == "SPDXRef-DOCUMENT"
    assert len(doc["packages"]) == 2  # Root + jsonwebtoken
    root_pkg = doc["packages"][0]
    assert root_pkg["SPDXID"] == "SPDXRef-Package-Root"
    assert root_pkg["licenseConcluded"] == "NOASSERTION"
    comp_pkg = doc["packages"][1]
    assert comp_pkg["name"] == "jsonwebtoken"
    assert comp_pkg["licenseConcluded"] == "MIT"
    assert comp_pkg["externalRefs"][0]["referenceLocator"] == "pkg:npm/jsonwebtoken@9.0.0"
