"""Ecosystem manifest parsers. Files are read as text. Nothing is executed."""

from __future__ import annotations

import json
import re
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import quote

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib  # type: ignore

from .detector import KIND_BY_NAME

REQ_LINE = re.compile(
    r"^\s*([A-Za-z0-9_.\-]+)\s*(?:\[[^\]]+\])?\s*((?:==|>=|<=|~=|!=|>|<)\s*[^;#\s]+)?"
)
PNPM_PKG = re.compile(r"^\s+/?((?:@[^/\s]+/)?[^@\s]+)@([^:\s]+):")
GRADLE_GAV = re.compile(
    r"""(?:implementation|api|compileOnly|runtimeOnly|testImplementation|compile|testCompile)\s*\(?\s*['\"]([^'\"]+)['\"]""",
    re.IGNORECASE,
)
GRADLE_MAP = re.compile(
    r"""(?:implementation|api|compileOnly|runtimeOnly|testImplementation|compile)\s*\(?\s*group\s*:\s*['\"]([^'\"]+)['\"]\s*,\s*name\s*:\s*['\"]([^'\"]+)['\"]\s*,\s*version\s*:\s*['\"]([^'\"]+)['\"]""",
    re.IGNORECASE,
)


def _id() -> str:
    return str(uuid.uuid4())


def purl_npm(name: str, version: str) -> str:
    if name.startswith("@") and "/" in name:
        scope, _, rest = name.partition("/")
        n = quote(scope, safe="") + "/" + quote(rest, safe="")
    else:
        n = quote(name, safe="")
    return "pkg:npm/" + n + "@" + quote(version, safe="")


def _comp(**kwargs) -> dict:
    base = {
        "id": _id(),
        "name": "",
        "version": "",
        "ecosystem": "",
        "package_manager": "",
        "purl": "",
        "scope": "runtime",
        "direct": False,
        "source_manifest": "",
        "license": "",
        "hash": "",
        "supplier": "",
        "cpe": "",
        "raw": {},
    }
    base.update(kwargs)
    return base


def parse_manifest(kind: str, path: Path, rel: str) -> dict:
    raw = path.read_bytes()
    if kind in ("NODE_PACKAGE_JSON",):
        return parse_package_json(raw, rel)
    if kind in ("NODE_NPM_LOCK", "NODE_NPM_SHRINKWRAP"):
        return parse_npm_lock(raw, rel)
    if kind == "NODE_YARN_LOCK":
        return parse_yarn_lock(raw, rel)
    if kind == "NODE_PNPM_LOCK":
        return parse_pnpm_lock(raw, rel)
    if kind == "PY_REQUIREMENTS":
        return parse_requirements(raw, rel)
    if kind == "PY_PYPROJECT":
        return parse_pyproject(raw, rel)
    if kind == "PY_POETRY_LOCK":
        return parse_poetry_lock(raw, rel)
    if kind == "PY_PIPFILE":
        return parse_pipfile(raw, rel)
    if kind == "PY_PIPFILE_LOCK":
        return parse_pipfile_lock(raw, rel)
    if kind == "JAVA_MAVEN_POM":
        return parse_pom(raw, rel)
    if kind == "JAVA_GRADLE_LOCK":
        return parse_gradle_lock(raw, rel)
    if kind == "JAVA_GRADLE":
        return parse_gradle(raw, rel)
    if kind == "GO_MODULE":
        return parse_go_mod(raw, rel)
    if kind == "GO_SUM":
        return parse_go_sum(raw, rel)
    if kind == "RUST_CARGO_LOCK":
        return parse_cargo_lock(raw, rel)
    if kind == "RUST_CARGO":
        return parse_cargo_toml(raw, rel)
    if kind == "DOTNET_PACKAGES_LOCK":
        return parse_nuget_lock(raw, rel)
    if kind == "DOTNET_PACKAGES_CONFIG":
        return parse_packages_config(raw, rel)
    if kind == "DOTNET_CSPROJ":
        return parse_csproj(raw, rel)
    if kind == "PHP_COMPOSER_LOCK":
        return parse_composer_lock(raw, rel)
    if kind == "PHP_COMPOSER_JSON":
        return parse_composer_json(raw, rel)
    if kind == "RUBY_GEMFILE_LOCK":
        return parse_gemfile_lock(raw, rel)
    if kind == "RUBY_GEMFILE":
        return parse_gemfile(raw, rel)
    raise KeyError(kind)


def parse_package_json(raw: bytes, rel: str) -> dict:
    data = json.loads(raw)
    res = {"components": [], "dependencies": [], "source_manifest": rel}

    def add(mapping, scope: str) -> None:
        if not isinstance(mapping, dict):
            return
        for name, ver in mapping.items():
            version = ver if isinstance(ver, str) else ""
            res["components"].append(
                _comp(
                    name=name,
                    version=version,
                    ecosystem="npm",
                    package_manager="npm",
                    purl=purl_npm(name, version),
                    scope=scope,
                    direct=True,
                    source_manifest=rel,
                )
            )

    add(data.get("dependencies"), "runtime")
    add(data.get("devDependencies"), "dev")
    add(data.get("optionalDependencies"), "optional")
    add(data.get("peerDependencies"), "peer")
    root_name = data.get("name") if isinstance(data.get("name"), str) else ""
    root_version = data.get("version") if isinstance(data.get("version"), str) else ""
    if root_name and _literal_version(root_version):
        res["components"].append(
            _comp(
                name=root_name,
                version=root_version,
                ecosystem="npm",
                package_manager="npm",
                purl=purl_npm(root_name, root_version),
                direct=True,
                source_manifest=rel,
            )
        )
    return res


def _lock_name(path: str, pkg: dict) -> str:
    name = pkg.get("name") or ""
    if name:
        return name
    name = path.removeprefix("node_modules/")
    idx = name.rfind("/node_modules/")
    if idx != -1:
        name = name[idx + len("/node_modules/") :]
    return name


def parse_npm_lock(raw: bytes, rel: str) -> dict:
    data = json.loads(raw)
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    id_for: dict[str, str] = {}

    def add_comp(comp: dict) -> None:
        key = comp["name"] + "@" + comp["version"]
        if key in id_for:
            return
        comp["id"] = _id()
        comp["source_manifest"] = rel
        comp["ecosystem"] = "npm"
        comp["package_manager"] = "npm"
        if not comp.get("purl"):
            comp["purl"] = purl_npm(comp["name"], comp["version"])
        id_for[key] = comp["id"]
        res["components"].append(comp)

    packages = data.get("packages") or {}
    if isinstance(packages, dict):
        for path, pkg in packages.items():
            if path == "" or not isinstance(pkg, dict):
                continue
            name = _lock_name(path, pkg)
            scope = "runtime"
            if pkg.get("dev"):
                scope = "dev"
            elif pkg.get("optional"):
                scope = "optional"
            trimmed = path.removeprefix("node_modules/")
            direct = path.startswith("node_modules/") and "/node_modules/" not in trimmed
            add_comp(
                _comp(
                    name=name,
                    version=pkg.get("version") or "",
                    scope=scope,
                    license=_first_license(pkg.get("license")),
                    hash=pkg.get("integrity") or "",
                    direct=direct,
                    raw={"resolved": pkg.get("resolved") or "", "integrity": pkg.get("integrity") or ""},
                )
            )

    def walk_v1(deps, parent_name: str) -> None:
        if not isinstance(deps, dict):
            return
        for name, dep in deps.items():
            if not isinstance(dep, dict):
                continue
            scope = "runtime"
            if dep.get("dev"):
                scope = "dev"
            elif dep.get("optional"):
                scope = "optional"
            version = dep.get("version") or ""
            add_comp(
                _comp(
                    name=name,
                    version=version,
                    scope=scope,
                    hash=dep.get("integrity") or "",
                    direct=parent_name == "",
                    raw={"resolved": dep.get("resolved") or "", "integrity": dep.get("integrity") or ""},
                )
            )
            walk_v1(dep.get("dependencies"), name)

    walk_v1(data.get("dependencies"), "")
    _link_lock(packages if isinstance(packages, dict) else {}, res)
    return res


def _link_lock(packages: dict, res: dict) -> None:
    by_name: dict[str, list[int]] = {}
    id_by_key = {}
    for i, comp in enumerate(res["components"]):
        by_name.setdefault(comp["name"], []).append(i)
        id_by_key[comp["name"] + "@" + comp["version"]] = comp["id"]
    for path, pkg in packages.items():
        if path == "" or not isinstance(pkg, dict) or not pkg.get("dependencies"):
            continue
        name = _lock_name(path, pkg)
        from_id = id_by_key.get(name + "@" + (pkg.get("version") or ""))
        if not from_id:
            continue
        subs = list(pkg["dependencies"].keys())
        for dep in subs:
            idxs = by_name.get(dep) or []
            if len(idxs) != 1:
                continue
            to = res["components"][idxs[0]]
            res["dependencies"].append(
                {"id": _id(), "from_component_id": from_id, "to_component_id": to["id"], "kind": "runtime"}
            )
        for comp in res["components"]:
            if comp["id"] == from_id:
                comp.setdefault("raw", {})["declared_sub_dependencies"] = subs
                break


def _first_license(value) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("type") or ""
    if isinstance(value, list) and value and isinstance(value[0], str):
        return value[0]
    return ""


def parse_yarn_lock(raw: bytes, rel: str) -> dict:
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    names: list[str] = []
    version = ""

    def flush() -> None:
        nonlocal names, version
        if not version:
            names = []
            return
        seen = set()
        for name in names:
            name = name.strip('"')
            if not name or name in seen:
                continue
            seen.add(name)
            res["components"].append(
                _comp(
                    name=name,
                    version=version,
                    ecosystem="npm",
                    package_manager="yarn",
                    purl=purl_npm(name, version),
                    source_manifest=rel,
                )
            )
        names = []
        version = ""

    for line in raw.decode("utf-8", "replace").split("\n"):
        trim = line.strip()
        if not trim or trim.startswith("#"):
            continue
        if not line.startswith((" ", "\t")) and trim.endswith(":"):
            flush()
            header = trim[:-1]
            for part in header.split(","):
                part = part.strip().strip('"')
                name = part
                idx = part.rfind("@")
                if idx > 0:
                    name = part[:idx]
                names.append(name)
            continue
        if trim.startswith("version "):
            version = trim[len("version ") :].strip('"')
    flush()
    return res


def parse_pnpm_lock(raw: bytes, rel: str) -> dict:
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    seen = set()
    in_packages = False
    for line in raw.decode("utf-8", "replace").split("\n"):
        trim = line.strip()
        if trim == "packages:":
            in_packages = True
            continue
        if not in_packages:
            continue
        if line and line[0] not in " \t" and trim:
            break
        match = PNPM_PKG.match(line)
        if not match:
            continue
        name, version = match.group(1), match.group(2)
        key = name + "@" + version
        if key in seen:
            continue
        seen.add(key)
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="npm",
                package_manager="pnpm",
                purl=purl_npm(name, version),
                source_manifest=rel,
            )
        )
    return res


def parse_requirements(raw: bytes, rel: str) -> dict:
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    for line in raw.decode("utf-8", "replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        match = REQ_LINE.match(line)
        if not match or not match.group(1):
            continue
        name = match.group(1)
        version = (match.group(2) or "").strip()
        for prefix in ("==", ">=", "<=", "~=", "!="):
            if version.startswith(prefix):
                version = version[len(prefix) :]
                break
        version = version.strip()
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="pypi",
                package_manager="pip",
                purl=f"pkg:pypi/{name.lower()}@{version}",
                direct=True,
                source_manifest=rel,
            )
        )
    return res


def _split_py_dep(text: str) -> tuple[str, str]:
    text = text.strip()
    for sep in ("==", ">=", "<=", "~=", "!=", ">", "<"):
        idx = text.find(sep)
        if idx != -1:
            return text[:idx].strip(), text[idx + len(sep) :].strip()
    return text, ""


def _literal_version(value: str) -> bool:
    text = (value or "").strip()
    return bool(text) and "$" not in text and "{" not in text and not text.lower().startswith(("file:", "git+", "git:", "http:", "https:", "workspace:"))


def _poetry_version(value) -> str:
    if isinstance(value, str):
        return value.removeprefix("^").removeprefix("~")
    if isinstance(value, dict) and isinstance(value.get("version"), str):
        return value["version"].removeprefix("^").removeprefix("~")
    return ""


def parse_pyproject(raw: bytes, rel: str) -> dict:
    data = tomllib.loads(raw.decode("utf-8", "replace"))
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    project = data.get("project") or {}
    root_name = project.get("name") if isinstance(project.get("name"), str) else ""
    root_version = project.get("version") if isinstance(project.get("version"), str) else ""
    if root_name and _literal_version(root_version):
        res["components"].append(
            _comp(
                name=root_name,
                version=root_version,
                ecosystem="pypi",
                package_manager="pip",
                purl=f"pkg:pypi/{root_name.lower()}@{root_version}",
                direct=True,
                source_manifest=rel,
            )
        )
    for dep in project.get("dependencies") or []:
        if not isinstance(dep, str):
            continue
        name, version = _split_py_dep(dep)
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="pypi",
                package_manager="pip",
                purl=f"pkg:pypi/{name.lower()}@{version}",
                direct=True,
                source_manifest=rel,
            )
        )
    poetry = ((data.get("tool") or {}).get("poetry") or {})
    poetry_name = poetry.get("name") if isinstance(poetry.get("name"), str) else ""
    poetry_version = poetry.get("version") if isinstance(poetry.get("version"), str) else ""
    if poetry_name and _literal_version(poetry_version) and not root_name:
        res["components"].append(
            _comp(
                name=poetry_name,
                version=poetry_version,
                ecosystem="pypi",
                package_manager="poetry",
                purl=f"pkg:pypi/{poetry_name.lower()}@{poetry_version}",
                direct=True,
                source_manifest=rel,
            )
        )
    for name, value in (poetry.get("dependencies") or {}).items():
        if name == "python":
            continue
        version = _poetry_version(value)
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="pypi",
                package_manager="poetry",
                purl=f"pkg:pypi/{name.lower()}@{version}",
                direct=True,
                source_manifest=rel,
            )
        )
    for name, value in (poetry.get("dev-dependencies") or {}).items():
        version = _poetry_version(value)
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="pypi",
                package_manager="poetry",
                purl=f"pkg:pypi/{name.lower()}@{version}",
                direct=True,
                scope="dev",
                source_manifest=rel,
            )
        )
    return res


def parse_poetry_lock(raw: bytes, rel: str) -> dict:
    data = tomllib.loads(raw.decode("utf-8", "replace"))
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    for pkg in data.get("package") or []:
        scope = "dev" if pkg.get("category") == "dev" else "runtime"
        name = pkg.get("name") or ""
        version = pkg.get("version") or ""
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="pypi",
                package_manager="poetry",
                purl=f"pkg:pypi/{name.lower()}@{version}",
                scope=scope,
                source_manifest=rel,
            )
        )
    return res


def parse_pipfile(raw: bytes, rel: str) -> dict:
    data = tomllib.loads(raw.decode("utf-8", "replace"))
    res = {"components": [], "dependencies": [], "source_manifest": rel}

    def add(mapping, scope: str) -> None:
        for name, value in (mapping or {}).items():
            version = _poetry_version(value)
            res["components"].append(
                _comp(
                    name=name,
                    version=version,
                    ecosystem="pypi",
                    package_manager="pipenv",
                    purl=f"pkg:pypi/{name.lower()}@{version}",
                    direct=True,
                    scope=scope,
                    source_manifest=rel,
                )
            )

    add(data.get("packages"), "runtime")
    add(data.get("dev-packages"), "dev")
    return res


def parse_pipfile_lock(raw: bytes, rel: str) -> dict:
    data = json.loads(raw)
    res = {"components": [], "dependencies": [], "source_manifest": rel}

    def emit(mapping, scope: str) -> None:
        if not isinstance(mapping, dict):
            return
        for name, value in mapping.items():
            version = ""
            if isinstance(value, dict):
                version = str(value.get("version") or "").removeprefix("==")
            res["components"].append(
                _comp(
                    name=name,
                    version=version,
                    ecosystem="pypi",
                    package_manager="pipenv",
                    purl=f"pkg:pypi/{name.lower()}@{version}",
                    scope=scope,
                    source_manifest=rel,
                )
            )

    emit(data.get("default"), "runtime")
    emit(data.get("develop"), "dev")
    return res


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child_text(el: ET.Element, name: str) -> str:
    for child in list(el):
        if _local(child.tag) == name and child.text:
            return child.text.strip()
    return ""


def parse_pom(raw: bytes, rel: str) -> dict:
    root = ET.fromstring(raw)
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    seen = set()

    def add(dep: ET.Element) -> None:
        group = _child_text(dep, "groupId")
        artifact = _child_text(dep, "artifactId")
        version = _child_text(dep, "version")
        if not artifact:
            return
        name = group + ":" + artifact
        key = name + "@" + version
        if key in seen:
            return
        seen.add(key)
        scope = _child_text(dep, "scope") or "runtime"
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="maven",
                package_manager="maven",
                purl=f"pkg:maven/{group}/{artifact}@{version}",
                scope=scope,
                direct=True,
                source_manifest=rel,
            )
        )

    group = _child_text(root, "groupId")
    artifact = _child_text(root, "artifactId")
    version = _child_text(root, "version")
    if group and artifact and _literal_version(version):
        add_name = group + ":" + artifact
        res["components"].append(
            _comp(
                name=add_name,
                version=version,
                ecosystem="maven",
                package_manager="maven",
                purl=f"pkg:maven/{group}/{artifact}@{version}",
                direct=True,
                source_manifest=rel,
            )
        )
        seen.add(add_name + "@" + version)

    for child in list(root):
        tag = _local(child.tag)
        if tag == "dependencies":
            for dep in list(child):
                if _local(dep.tag) == "dependency":
                    add(dep)
        elif tag == "dependencyManagement":
            for sub in list(child):
                if _local(sub.tag) != "dependencies":
                    continue
                for dep in list(sub):
                    if _local(dep.tag) == "dependency":
                        add(dep)
    return res


def parse_gradle(raw: bytes, rel: str) -> dict:
    text = raw.decode("utf-8", "replace")
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    seen = set()

    def add(group: str, artifact: str, version: str, scope: str) -> None:
        if not group or not artifact or not _literal_version(version) or "+" in version:
            return
        name = group + ":" + artifact
        key = name + "@" + version
        if key in seen:
            return
        seen.add(key)
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="maven",
                package_manager="gradle",
                purl=f"pkg:maven/{group}/{artifact}@{version}",
                scope=scope,
                direct=True,
                source_manifest=rel,
            )
        )

    for match in GRADLE_GAV.finditer(text):
        parts = match.group(1).split(":")
        if len(parts) != 3:
            continue
        scope = "dev" if match.group(0).lower().startswith("test") else "runtime"
        add(parts[0], parts[1], parts[2], scope)
    for match in GRADLE_MAP.finditer(text):
        scope = "dev" if match.group(0).lower().startswith("test") else "runtime"
        add(match.group(1), match.group(2), match.group(3), scope)
    return res


def parse_gradle_lock(raw: bytes, rel: str) -> dict:
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    seen = set()
    for line in raw.decode("utf-8", "replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        gav = line.split("=", 1)[0]
        parts = gav.split(":", 2)
        if len(parts) != 3:
            continue
        group, artifact, version = parts
        name = group + ":" + artifact
        key = name + "@" + version
        if key in seen:
            continue
        seen.add(key)
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="maven",
                package_manager="gradle",
                purl=f"pkg:maven/{group}/{artifact}@{version}",
                source_manifest=rel,
            )
        )
    return res


def parse_go_mod(raw: bytes, rel: str) -> dict:
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    in_block = False
    for original in raw.decode("utf-8", "replace").splitlines():
        line = original.strip()
        if not line or line.startswith("//"):
            continue
        if line.startswith("require ("):
            in_block = True
            continue
        if in_block and line == ")":
            in_block = False
            continue
        if line.startswith("require "):
            line = line[len("require ") :]
        elif not in_block:
            continue
        if "//" in line:
            line = line[: line.index("//")].strip()
        parts = line.split()
        if len(parts) < 2:
            continue
        name, version = parts[0], parts[1]
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="go",
                package_manager="go",
                purl=f"pkg:golang/{name}@{version}",
                direct="// indirect" not in original,
                source_manifest=rel,
            )
        )
    return res


def parse_go_sum(raw: bytes, rel: str) -> dict:
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    seen = set()
    for line in raw.decode("utf-8", "replace").splitlines():
        parts = line.split()
        if len(parts) < 2:
            continue
        name, version = parts[0], parts[1]
        if version.endswith("/go.mod"):
            version = version[: -len("/go.mod")]
        key = name + "@" + version
        if not name or not version or key in seen:
            continue
        seen.add(key)
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="go",
                package_manager="go",
                purl=f"pkg:golang/{name}@{version}",
                source_manifest=rel,
            )
        )
    return res


def parse_cargo_lock(raw: bytes, rel: str) -> dict:
    data = tomllib.loads(raw.decode("utf-8", "replace"))
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    for pkg in data.get("package") or []:
        name = pkg.get("name") or ""
        version = pkg.get("version") or ""
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="cargo",
                package_manager="cargo",
                purl=f"pkg:cargo/{name}@{version}",
                source_manifest=rel,
            )
        )
    return res


def parse_cargo_toml(raw: bytes, rel: str) -> dict:
    data = tomllib.loads(raw.decode("utf-8", "replace"))
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    pkg = data.get("package") or {}
    root_name = pkg.get("name") if isinstance(pkg.get("name"), str) else ""
    root_version = pkg.get("version") if isinstance(pkg.get("version"), str) else ""
    if root_name and _literal_version(root_version):
        res["components"].append(
            _comp(
                name=root_name,
                version=root_version,
                ecosystem="cargo",
                package_manager="cargo",
                purl=f"pkg:cargo/{root_name}@{root_version}",
                direct=True,
                source_manifest=rel,
            )
        )

    def emit(deps, scope: str) -> None:
        for name, value in (deps or {}).items():
            version = _poetry_version(value)
            res["components"].append(
                _comp(
                    name=name,
                    version=version,
                    ecosystem="cargo",
                    package_manager="cargo",
                    purl=f"pkg:cargo/{name}@{version}",
                    direct=True,
                    scope=scope,
                    source_manifest=rel,
                )
            )

    emit(data.get("dependencies"), "runtime")
    emit(data.get("dev-dependencies"), "dev")
    return res


def parse_nuget_lock(raw: bytes, rel: str) -> dict:
    data = json.loads(raw)
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    deps = data.get("dependencies") or {}
    if isinstance(deps, dict):
        for tfm in deps.values():
            if not isinstance(tfm, dict):
                continue
            for name, item in tfm.items():
                version = item.get("resolved") if isinstance(item, dict) else ""
                res["components"].append(
                    _comp(
                        name=name,
                        version=version or "",
                        ecosystem="nuget",
                        package_manager="nuget",
                        purl=f"pkg:nuget/{name}@{version or ''}",
                        source_manifest=rel,
                    )
                )
    return res


def parse_packages_config(raw: bytes, rel: str) -> dict:
    root = ET.fromstring(raw)
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    for el in root.iter():
        if _local(el.tag) != "package":
            continue
        name = el.attrib.get("id") or ""
        version = el.attrib.get("version") or ""
        if not name:
            continue
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="nuget",
                package_manager="nuget",
                purl=f"pkg:nuget/{name}@{version}",
                direct=True,
                source_manifest=rel,
            )
        )
    return res


def parse_csproj(raw: bytes, rel: str) -> dict:
    root = ET.fromstring(raw)
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    for el in root.iter():
        if _local(el.tag) != "PackageReference":
            continue
        name = el.attrib.get("Include") or el.attrib.get("Update") or ""
        version = el.attrib.get("Version") or _child_text(el, "Version")
        if not name:
            continue
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="nuget",
                package_manager="nuget",
                purl=f"pkg:nuget/{name}@{version}",
                direct=True,
                source_manifest=rel,
            )
        )
    return res


def parse_composer_lock(raw: bytes, rel: str) -> dict:
    data = json.loads(raw)
    res = {"components": [], "dependencies": [], "source_manifest": rel}

    def emit(items, scope: str) -> None:
        if not isinstance(items, list):
            return
        for pkg in items:
            if not isinstance(pkg, dict):
                continue
            name = pkg.get("name") or ""
            version = pkg.get("version") or ""
            res["components"].append(
                _comp(
                    name=name,
                    version=version,
                    ecosystem="composer",
                    package_manager="composer",
                    purl=f"pkg:composer/{name}@{version}",
                    scope=scope,
                    source_manifest=rel,
                )
            )

    emit(data.get("packages"), "runtime")
    emit(data.get("packages-dev"), "dev")
    return res


def parse_composer_json(raw: bytes, rel: str) -> dict:
    data = json.loads(raw)
    res = {"components": [], "dependencies": [], "source_manifest": rel}

    def emit(mapping, scope: str) -> None:
        if not isinstance(mapping, dict):
            return
        for name, version in mapping.items():
            if name.startswith("php") or name.startswith("ext-"):
                continue
            ver = version if isinstance(version, str) else ""
            res["components"].append(
                _comp(
                    name=name,
                    version=ver,
                    ecosystem="composer",
                    package_manager="composer",
                    purl=f"pkg:composer/{name}@{ver}",
                    direct=True,
                    scope=scope,
                    source_manifest=rel,
                )
            )

    emit(data.get("require"), "runtime")
    emit(data.get("require-dev"), "dev")
    root_name = data.get("name") if isinstance(data.get("name"), str) else ""
    root_version = data.get("version") if isinstance(data.get("version"), str) else ""
    if root_name and _literal_version(root_version) and not root_name.startswith(("php", "ext-")):
        res["components"].append(
            _comp(
                name=root_name,
                version=root_version,
                ecosystem="composer",
                package_manager="composer",
                purl=f"pkg:composer/{root_name}@{root_version}",
                direct=True,
                source_manifest=rel,
            )
        )
    return res


def parse_gemfile(raw: bytes, rel: str) -> dict:
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    for line in raw.decode("utf-8", "replace").splitlines():
        text = line.strip()
        if not text.startswith("gem "):
            continue
        parts = text.split(",", 2)
        name = ""
        version = ""
        for i, part in enumerate(parts):
            part = part.strip().strip("'\"")
            if i == 0:
                name = part.removeprefix("gem ").strip("'\"")
            elif not version:
                version = part.lstrip("~>=< ")
        if not name:
            continue
        res["components"].append(
            _comp(
                name=name,
                version=version,
                ecosystem="rubygems",
                package_manager="bundler",
                purl=f"pkg:gem/{name}@{version}",
                direct=True,
                source_manifest=rel,
            )
        )
    return res


def parse_gemfile_lock(raw: bytes, rel: str) -> dict:
    res = {"components": [], "dependencies": [], "source_manifest": rel}
    in_specs = False
    for line in raw.decode("utf-8", "replace").splitlines():
        if line.strip() == "specs:":
            in_specs = True
            continue
        if not in_specs:
            continue
        if line.startswith("    ") and not line.startswith("      "):
            text = line.strip()
            open_i = text.find("(")
            close_i = text.find(")")
            if open_i == -1 or close_i == -1:
                continue
            name = text[:open_i].strip()
            version = text[open_i + 1 : close_i]
            res["components"].append(
                _comp(
                    name=name,
                    version=version,
                    ecosystem="rubygems",
                    package_manager="bundler",
                    purl=f"pkg:gem/{name}@{version}",
                    source_manifest=rel,
                )
            )
        elif line and not line.startswith(" "):
            in_specs = False
    return res


# Imported by detector registration checks.
_ = KIND_BY_NAME
