"""Walk a project tree and list recognised manifest files."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BY_FILENAME = {
    "package.json": ("NODE_PACKAGE_JSON", "npm", 1),
    "package-lock.json": ("NODE_NPM_LOCK", "npm", 5),
    "npm-shrinkwrap.json": ("NODE_NPM_SHRINKWRAP", "npm", 6),
    "requirements.txt": ("PY_REQUIREMENTS", "pypi", 2),
    "pyproject.toml": ("PY_PYPROJECT", "pypi", 3),
    "poetry.lock": ("PY_POETRY_LOCK", "pypi", 5),
    "Pipfile": ("PY_PIPFILE", "pypi", 3),
    "Pipfile.lock": ("PY_PIPFILE_LOCK", "pypi", 5),
    "pom.xml": ("JAVA_MAVEN_POM", "maven", 5),
    "gradle.lockfile": ("JAVA_GRADLE_LOCK", "maven", 5),
    "go.mod": ("GO_MODULE", "go", 4),
    "go.sum": ("GO_SUM", "go", 5),
    "Cargo.toml": ("RUST_CARGO", "cargo", 3),
    "Cargo.lock": ("RUST_CARGO_LOCK", "cargo", 5),
    "packages.config": ("DOTNET_PACKAGES_CONFIG", "nuget", 3),
    "packages.lock.json": ("DOTNET_PACKAGES_LOCK", "nuget", 5),
    "composer.json": ("PHP_COMPOSER_JSON", "composer", 3),
    "composer.lock": ("PHP_COMPOSER_LOCK", "composer", 5),
    "Gemfile": ("RUBY_GEMFILE", "rubygems", 3),
    "Gemfile.lock": ("RUBY_GEMFILE_LOCK", "rubygems", 5),
    "yarn.lock": ("NODE_YARN_LOCK", "npm", 5),
    "pnpm-lock.yaml": ("NODE_PNPM_LOCK", "npm", 5),
}

GRADLE_FILES = {"build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"}
_BY_LOWER = {name.lower(): spec for name, spec in BY_FILENAME.items()}

ALWAYS_IGNORE = {
    ".git", ".svn", ".hg", "__pycache__", ".pytest_cache", "dist", "target", "build",
    ".idea", ".vscode", "bin", "obj", ".next", "coverage", ".tox", ".mypy_cache",
    "bower_components", ".vs", ".gradle", "env",
}
INSTALLED_IGNORE = {"node_modules", "venv", ".venv", "vendor"}

KIND_BY_NAME = set(BY_FILENAME) | GRADLE_FILES


@dataclass
class Detected:
    kind: str
    path: Path
    rel: str
    ecosystem: str
    priority: int


@dataclass
class Notes:
    skipped_oversized: int = 0
    unreadable: int = 0
    truncated: bool = False


def match_file(base: str) -> tuple[str, str, int] | None:
    found = BY_FILENAME.get(base) or _BY_LOWER.get(base.lower())
    if found:
        return found
    lower = base.lower()
    if lower.endswith(".csproj"):
        return ("DOTNET_CSPROJ", "nuget", 3)
    if lower in GRADLE_FILES:
        return ("JAVA_GRADLE", "maven", 3)
    return None


def detect(root: str | Path, scan_installed: bool = False, max_depth: int = 30) -> tuple[list[Detected], Notes]:
    notes = Notes()
    if not root:
        return [], notes
    root_path = Path(root)
    if not root_path.is_dir():
        notes.unreadable += 1
        return [], notes
    max_bytes = int(os.environ.get("BOM_MAX_MANIFEST_BYTES") or 64 * 1024 * 1024)
    max_units = int(os.environ.get("BOM_MAX_SCAN_UNITS") or 20000)
    out: list[Detected] = []

    def walk(directory: Path, depth: int) -> None:
        if len(out) >= max_units:
            notes.truncated = True
            return
        try:
            entries = list(directory.iterdir())
        except OSError:
            notes.unreadable += 1
            return
        for entry in entries:
            if len(out) >= max_units:
                notes.truncated = True
                return
            name = entry.name
            try:
                if entry.is_symlink():
                    continue
                if entry.is_dir():
                    lower = name.lower()
                    if lower in ALWAYS_IGNORE:
                        continue
                    if not scan_installed and lower in INSTALLED_IGNORE:
                        continue
                    if depth >= max_depth:
                        continue
                    walk(entry, depth + 1)
                    continue
                matched = match_file(name)
                if not matched:
                    continue
                size = entry.stat().st_size
                if size > max_bytes:
                    notes.skipped_oversized += 1
                    continue
                rel = entry.relative_to(root_path).as_posix()
                kind, eco, priority = matched
                out.append(Detected(kind, entry, rel, eco, priority))
            except OSError:
                notes.unreadable += 1

    walk(root_path, 0)
    return out, notes
