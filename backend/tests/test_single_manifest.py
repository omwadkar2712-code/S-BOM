"""One manifest file per ecosystem is scanned and sent to MITRE."""

from pathlib import Path

from app.scanner.detector import detect
from app.scanner.pipeline import dedupe, scan_tree
from app.sources.workspace import is_supported_manifest
from app.vulnerabilities.provider import VulnProvider, query_version

OSV_NAMES = {
    "npm": "npm",
    "pypi": "PyPI",
    "maven": "Maven",
    "go": "Go",
    "cargo": "crates.io",
    "nuget": "NuGet",
    "composer": "Packagist",
    "rubygems": "RubyGems",
    "pub": "Pub",
    "hex": "Hex",
    "swift": "SwiftURL",
    "conan": "ConanCenter",
    "opam": "opam",
    "cran": "CRAN",
    "hackage": "Hackage",
}


def _scan(tmp_path: Path, filename: str, text: str) -> dict:
    folder = tmp_path / filename.replace(".", "_").replace("/", "_")
    folder.mkdir()
    (folder / filename).write_text(text, encoding="utf-8")
    return scan_tree(str(folder), "test")


def test_query_version_keeps_a_single_number_and_a_range():
    assert query_version("1") == "1"
    assert query_version("^1.2.5") == "1.2.5"
    assert query_version("~> 1.13.0") == "1.13.0"
    assert query_version("[12.0.3, 13.0.0)") == "12.0.3"
    assert query_version("v1.9.0") == "v1.9.0"
    assert query_version("*") == ""
    assert query_version("file:../pkg") == ""


def test_one_file_per_ecosystem_is_a_mitre_target(tmp_path: Path):
    samples = {
        "package.json": ('{"name":"demo","version":"1.0.0","dependencies":{"minimist":"^1.2.5"}}', "minimist", "1.2.5", "npm"),
        "requirements.txt": ("flask==2.0.1\n", "flask", "2.0.1", "pypi"),
        "pom.xml": (
            "<project><dependencies><dependency><groupId>org.apache.logging.log4j</groupId>"
            "<artifactId>log4j-core</artifactId><version>2.14.1</version></dependency></dependencies></project>",
            "org.apache.logging.log4j:log4j-core",
            "2.14.1",
            "maven",
        ),
        "build.gradle": (
            "dependencies { implementation 'org.apache.logging.log4j:log4j-core:2.14.1' }\n",
            "org.apache.logging.log4j:log4j-core",
            "2.14.1",
            "maven",
        ),
        "go.mod": ("module example.com/demo\n\ngo 1.22\n\nrequire github.com/gin-gonic/gin v1.9.0\n", "github.com/gin-gonic/gin", "v1.9.0", "go"),
        "go.sum": ("github.com/gin-gonic/gin v1.9.0 h1:abc\n", "github.com/gin-gonic/gin", "v1.9.0", "go"),
        "Cargo.toml": ('[dependencies]\nserde = "1"\n', "serde", "1", "cargo"),
        "packages.config": ('<packages><package id="Newtonsoft.Json" version="12.0.3" /></packages>', "Newtonsoft.Json", "12.0.3", "nuget"),
        "App.csproj": (
            '<Project><ItemGroup><PackageReference Include="Newtonsoft.Json"><Version>12.0.3</Version></PackageReference></ItemGroup></Project>',
            "Newtonsoft.Json",
            "12.0.3",
            "nuget",
        ),
        "composer.json": ('{"require":{"guzzlehttp/guzzle":"^6.5.0"}}', "guzzlehttp/guzzle", "6.5.0", "composer"),
        "Gemfile": ("gem 'nokogiri', '~> 1.13.0'\n", "nokogiri", "1.13.0", "rubygems"),
        "pubspec.yaml": ("name: demo\ndependencies:\n  http: ^1.1.0\n", "http", "1.1.0", "pub"),
        "mix.exs": ('defp deps do\n    [{:phoenix, "~> 1.7.0"}]\n  end\n', "phoenix", "1.7.0", "hex"),
        "Package.swift": (
            '.package(url: "https://github.com/apple/swift-nio.git", from: "2.0.0")\n',
            "swift-nio",
            "2.0.0",
            "swift",
        ),
        "conanfile.txt": ("[requires]\nopenssl/3.0.5\n", "openssl", "3.0.5", "conan"),
        "DESCRIPTION": ("Package: demo\nImports: dplyr (>= 1.0.0)\n", "dplyr", "1.0.0", "cran"),
        "demo.opam": ('depends: [ "yojson" {>= "1.7.0"} ]\n', "yojson", "", "opam"),
        "demo.cabal": ("name: demo\nbuild-depends: aeson >= 2.0\n", "aeson", "2.0", "hackage"),
    }
    provider = VulnProvider("mitre", 5, "https://cveawg.mitre.org/api")
    for filename, (text, name, version, ecosystem) in samples.items():
        snap = _scan(tmp_path, filename, text)
        targets = provider._targets(snap)
        found = [item for _, item in targets if item["package"]["name"] == name]
        assert found, filename
        if version:
            assert found[0]["version"] == version
        assert found[0]["package"]["ecosystem"] == OSV_NAMES[ecosystem]


def test_mixed_ecosystem_folder_is_scanned_together(tmp_path: Path):
    root = tmp_path / "folder1"
    root.mkdir()
    (root / "package.json").write_text('{"name":"demo","version":"1.0.0","dependencies":{"minimist":"1.2.5"}}', encoding="utf-8")
    (root / "requirements.txt").write_text("flask==2.0.1\n", encoding="utf-8")
    (root / "go.mod").write_text("module example.com/demo\n\ngo 1.22\n\nrequire github.com/gin-gonic/gin v1.9.0\n", encoding="utf-8")
    (root / "Cargo.toml").write_text('[package]\nname="demo"\nversion="0.1.0"\n\n[dependencies]\nserde = "1.0.0"\n', encoding="utf-8")
    (root / "composer.json").write_text('{"require":{"guzzlehttp/guzzle":"6.5.0"}}', encoding="utf-8")
    (root / "Gemfile").write_text("gem 'nokogiri', '1.13.0'\n", encoding="utf-8")
    (root / "pubspec.yaml").write_text("name: demo\ndependencies:\n  http: 1.1.0\n", encoding="utf-8")
    snap = scan_tree(str(root), "test")
    by_eco = {(c["name"], c["ecosystem"]) for c in snap["components"]}
    assert ("minimist", "npm") in by_eco
    assert ("flask", "pypi") in by_eco
    assert ("github.com/gin-gonic/gin", "go") in by_eco
    assert ("serde", "cargo") in by_eco
    assert ("guzzlehttp/guzzle", "composer") in by_eco
    assert ("nokogiri", "rubygems") in by_eco
    assert ("http", "pub") in by_eco
    targets = VulnProvider("mitre", 5, "https://cveawg.mitre.org/api")._targets(snap)
    ecosystems = {item["package"]["ecosystem"] for _, item in targets}
    assert ecosystems >= {"npm", "PyPI", "Go", "crates.io", "Packagist", "RubyGems", "Pub"}


def test_a_manifest_with_only_itself_is_still_scanned(tmp_path: Path):
    snap = _scan(tmp_path, "package.json", '{"name":"lodash","version":"4.17.15"}')
    assert [(c["name"], c["version"], c["ecosystem"]) for c in snap["components"]] == [("lodash", "4.17.15", "npm")]
    targets = VulnProvider("mitre", 5, "https://cveawg.mitre.org/api")._targets(snap)
    assert targets[0][1]["package"]["ecosystem"] == "npm"
    assert targets[0][1]["version"] == "4.17.15"


def test_lowercase_single_filename_is_detected(tmp_path: Path):
    assert is_supported_manifest("cargo.toml")
    assert is_supported_manifest("GEMFILE")
    assert is_supported_manifest("pubspec.yaml")
    assert is_supported_manifest("App.vbproj")
    assert is_supported_manifest("lib.opam")
    folder = tmp_path / "one"
    folder.mkdir()
    (folder / "cargo.toml").write_text('[package]\nname="demo"\nversion="0.1.0"\n', encoding="utf-8")
    found, _notes = detect(folder)
    assert [item.rel for item in found] == ["cargo.toml"]
    assert found[0].ecosystem == "cargo"


def test_gemfile_without_a_version_is_still_queried(tmp_path: Path):
    snap = _scan(tmp_path, "Gemfile", "gem 'nokogiri'\n")
    targets = VulnProvider("mitre", 5, "https://cveawg.mitre.org/api")._targets(snap)
    assert targets[0][1]["package"] == {"name": "nokogiri", "ecosystem": "RubyGems"}
    assert "version" not in targets[0][1]


def test_lockfile_version_replaces_a_blank_declaration():
    blank = {"id": "a", "name": "bcrypt", "version": "", "ecosystem": "rubygems", "direct": True}
    pinned = {"id": "b", "name": "bcrypt", "version": "3.1.21", "ecosystem": "rubygems", "direct": False}
    comps, _deps = dedupe([blank, pinned], [])
    assert [(comp["name"], comp["version"]) for comp in comps] == [("bcrypt", "3.1.21")]
    assert comps[0]["direct"] is True


def test_one_component_fetches_the_cve_from_mitre(monkeypatch):
    calls = []

    class Response:
        def __init__(self, payload, status=200):
            self._payload = payload
            self.status_code = status

        def raise_for_status(self):
            return None

        def json(self):
            return self._payload

    class Client:
        def __init__(self, *args, **kwargs):
            return None

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, json=None):
            calls.append(url)
            return Response({"results": [{"vulns": [{"id": "GHSA-test", "aliases": ["CVE-2021-44906"]}]}]})

        def get(self, url, headers=None):
            calls.append(url)
            return Response(
                {
                    "cveMetadata": {"state": "PUBLISHED", "cveId": "CVE-2021-44906"},
                    "containers": {
                        "cna": {
                            "descriptions": [{"lang": "en", "value": "prototype pollution"}],
                            "metrics": [{"cvssV3_1": {"baseScore": 9.8, "baseSeverity": "CRITICAL", "vectorString": "CVSS:3.1/AV:N"}}],
                        }
                    },
                }
            )

    monkeypatch.setattr("app.vulnerabilities.provider.httpx.Client", Client)
    snap = {"components": [{"id": "only", "name": "minimist", "version": "^1.2.5", "ecosystem": "npm"}]}
    VulnProvider("mitre", 5, "https://cveawg.mitre.org/api").correlate(snap)
    matches = snap["raw_metadata"]["vulnerability_matches"]
    assert matches[0]["vulnerability_id"] == "CVE-2021-44906"
    assert matches[0]["source"] == "mitre"
    assert any(url.startswith("https://cveawg.mitre.org/api/cve/CVE-2021-44906") for url in calls)
