"""Local uploads, GitHub downloads, and bulk spreadsheets."""

from __future__ import annotations

import csv
import io
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from urllib.parse import urlparse

import httpx
from openpyxl import load_workbook

from .security import ExtractLimits, UnsafeHost, assert_safe_host, extract_tar_gz, extract_zip, validate_outbound

GITHUB_RE = re.compile(r"^/([^/\s]+)/([^/\s]+?)(?:\.git)?/?$")
MANIFEST_NAMES = {
    "package.json", "package-lock.json", "npm-shrinkwrap.json", "requirements.txt", "pyproject.toml",
    "poetry.lock", "Pipfile", "Pipfile.lock", "pom.xml", "go.mod", "go.sum", "Cargo.toml", "Cargo.lock",
    "packages.config", "packages.lock.json", "composer.json", "composer.lock", "Gemfile", "Gemfile.lock",
    "yarn.lock", "pnpm-lock.yaml", "build.gradle", "build.gradle.kts", "settings.gradle",
    "settings.gradle.kts", "gradle.lockfile",
}
SKIP_DIRS = {".git", "node_modules", "vendor", "venv", ".venv", "dist", "target", "build", "__pycache__", ".gradle"}


class Workspace:
    def __init__(self, parent: Path, root: Path, metadata: dict | None = None) -> None:
        self.parent = parent
        self.root = root
        self.metadata = metadata or {}

    def cleanup(self) -> None:
        shutil.rmtree(self.parent, ignore_errors=True)


def prepare_local(store, bucket: str, payload: dict, limits: ExtractLimits, temp_dir: str | None) -> Workspace:
    key = payload.get("object_key") or ""
    filename = payload.get("file_name") or ""
    if not key:
        raise RuntimeError("object_key missing")
    parent = Path(tempfile.mkdtemp(prefix="sbom-local-", dir=temp_dir or None))
    try:
        staged = parent / _staged_name(filename)
        with store.open(bucket, key) as src, staged.open("wb") as out:
            shutil.copyfileobj(src, out)
        extract_dir = parent / "src"
        extract_dir.mkdir()
        lower = staged.name.lower()
        if lower.endswith(".zip"):
            extract_zip(staged, extract_dir, limits)
        elif lower.endswith(".tar.gz") or lower.endswith(".tgz"):
            extract_tar_gz(staged, extract_dir, limits)
        else:
            target = extract_dir / Path(filename).name
            shutil.copyfile(staged, target)
        return Workspace(parent, extract_dir, {})
    except Exception:
        shutil.rmtree(parent, ignore_errors=True)
        raise


def _staged_name(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".zip"):
        return "upload.zip"
    if lower.endswith(".tar.gz") or lower.endswith(".tgz"):
        return "upload.tar.gz"
    return Path(filename).name or "upload.bin"


def canonical_github_url(raw: str) -> str:
    """https://github.com/{owner}/{repo}, without .git or extra path segments."""
    parsed = urlparse((raw or "").strip())
    if parsed.scheme.lower() != "https":
        raise ValueError("repository_url must use https")
    host = (parsed.hostname or "").lower()
    if host != "github.com":
        raise ValueError("only github.com repositories are supported")
    match = GITHUB_RE.match(parsed.path or "")
    if not match:
        raise ValueError("repository_url must be of the form https://github.com/{owner}/{repo}")
    return f"https://github.com/{match.group(1)}/{match.group(2)}"


def bulk_project_key(repository_url: str, branch: str) -> str:
    """Identity of one bulk-scan project: repository plus branch.

    Owner and repository are compared case-insensitively. The branch is kept
    as written, so `main` and `Main` are different projects.
    """
    parsed = urlparse(repository_url)
    match = GITHUB_RE.match(parsed.path or "")
    repo = f"{match.group(1).lower()}/{match.group(2).lower()}" if match else repository_url.lower()
    return repo + "|" + (branch or "")


def validate_repo_url(raw: str) -> dict:
    if not raw:
        raise ValueError("repository_url is required")
    url = canonical_github_url(raw)
    try:
        validate_outbound(url, ["https"], ["github.com"])
    except UnsafeHost as exc:
        raise ValueError(str(exc)) from exc
    match = GITHUB_RE.match(urlparse(url).path or "")
    if not match:
        raise ValueError("repository_url must be of the form https://github.com/{owner}/{repo}")
    return {"owner": match.group(1), "repo": match.group(2), "host": "github.com"}


class _SafeClient(httpx.Client):
    def send(self, request, **kwargs):
        assert_safe_host(request.url.host)
        return super().send(request, **kwargs)


def prepare_github(payload: dict, api_base: str, timeout: float, limits: ExtractLimits, max_tar: int, creds, temp_dir: str | None) -> Workspace:
    raw_url = payload.get("repository_url") or ""
    branch = payload.get("branch") or ""
    repo = validate_repo_url(raw_url)
    token = ""
    cred_id = payload.get("credential_id") or ""
    if cred_id and creds is not None:
        material = creds.resolve(cred_id, payload.get("organization_id") or "")
        token = material.decode().strip()
        if token.startswith("APP_ID:"):
            raise RuntimeError("GitHub App credentials are stored, but installation tokens are not minted by this build")
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "bom-engine",
    }
    if token:
        headers["Authorization"] = "Bearer " + token
    base = api_base.rstrip("/")
    with _SafeClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        meta = client.get(f"{base}/repos/{repo['owner']}/{repo['repo']}")
        _raise_github(meta)
        meta_json = meta.json()
        if not branch:
            branch = meta_json.get("default_branch") or "main"
        branch_res = client.get(f"{base}/repos/{repo['owner']}/{repo['repo']}/branches/{branch}")
        _raise_github(branch_res)
        commit = (branch_res.json().get("commit") or {})
        sha = commit.get("sha") or ""
        inner = commit.get("commit") or {}
        author = (inner.get("author") or {})
        parent = Path(tempfile.mkdtemp(prefix="sbom-gh-", dir=temp_dir or None))
        try:
            tar_path = parent / "repo.tar.gz"
            with _SafeClient(timeout=30 * 60, follow_redirects=True, headers=headers) as downloader:
                with downloader.stream("GET", f"{base}/repos/{repo['owner']}/{repo['repo']}/tarball/{sha}") as response:
                    _raise_github(response)
                    written = 0
                    with tar_path.open("wb") as out:
                        for chunk in response.iter_bytes():
                            written += len(chunk)
                            if written > max_tar:
                                raise RuntimeError("tarball exceeds size limit")
                            out.write(chunk)
            extract_dir = parent / "src"
            extract_dir.mkdir()
            extract_tar_gz(tar_path, extract_dir, limits)
            entries = [p for p in extract_dir.iterdir() if p.is_dir() and not p.is_symlink()]
            root = entries[0] if len(entries) == 1 and len(list(extract_dir.iterdir())) == 1 else extract_dir
            return Workspace(
                parent,
                root,
                {
                    "repository_url": f"https://{repo['host']}/{repo['owner']}/{repo['repo']}",
                    "repository_branch": branch,
                    "commit_sha": sha,
                    "commit_author": author.get("name") or "",
                    "commit_email": author.get("email") or "",
                    "commit_message": inner.get("message") or "",
                },
            )
        except Exception:
            shutil.rmtree(parent, ignore_errors=True)
            raise


def _raise_github(response: httpx.Response) -> None:
    if response.status_code in (403, 429):
        from .metrics import METRICS

        METRICS.add("github_api_rate_limit")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"github {response.request.url.path}: {response.status_code}")
    from .metrics import METRICS

    METRICS.add("github_api_requests")


_MANIFEST_LOWER = {name.lower() for name in MANIFEST_NAMES}


def is_supported_manifest(name: str) -> bool:
    base = Path(name.replace("\\", "/")).name
    lower = base.lower()
    if lower in _MANIFEST_LOWER:
        return True
    return lower.endswith(".csproj") or lower.endswith(".vbproj") or lower.endswith(".fsproj")


def safe_upload_rel(name: str) -> str:
    name = name.replace("\\", "/").lstrip("/")
    if not name or "\x00" in name or ":" in name:
        raise ValueError("unsafe")
    parts = []
    for part in name.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            raise ValueError("unsafe")
        parts.append(part)
    if not parts:
        raise ValueError("unsafe")
    return "/".join(parts)


def path_skipped(rel: str) -> bool:
    parts = rel.split("/")[:-1]
    return any(part.lower() in SKIP_DIRS for part in parts)


def pack_folder(files: list[tuple[str, bytes]]) -> tuple[bytes, str]:
    """files is (relative path, content)."""
    buf = io.BytesIO()
    seen = set()
    packed = []
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_STORED) as zf:
        for name, content in files:
            rel = safe_upload_rel(name)
            if path_skipped(rel) or not is_supported_manifest(rel) or rel in seen:
                continue
            if len(content) > 64 * 1024 * 1024:
                continue
            zf.writestr(rel, content)
            seen.add(rel)
            packed.append(rel)
    if not packed:
        raise LookupError("no manifest")
    root = packed[0].split("/")[0]
    if "/" not in packed[0] or any(path.split("/")[0] != root for path in packed[1:]):
        archive_name = "folder.zip"
    else:
        archive_name = Path(root).name + ".zip"
    return buf.getvalue(), archive_name


def parse_bulk(filename: str, data: bytes, max_bytes: int) -> tuple[list[dict], list[dict]]:
    """Split a bulk spreadsheet into data rows and row problems.

    Blank rows are ignored. A row is invalid when a required field is missing,
    the repository URL is not `https://github.com/{owner}/{repo}`, or scan_type
    is not GITHUB. Those rows are returned with the valid ones so the caller
    can record them, and they are not a project that will be scanned.

    A duplicate project is a later row with the same repository and branch as
    an earlier valid row. The first row is kept. The later row is reported as
    DUPLICATE_PROJECT and must not be queued. The same project name with a
    different repository or branch is a different project.
    """
    if len(data) > max_bytes:
        raise ValueError("file exceeds size limit")
    lower = filename.lower()
    if lower.endswith(".csv"):
        rows = list(csv.reader(io.StringIO(data.decode("utf-8-sig", "replace"))))
    elif lower.endswith(".xlsx"):
        book = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        sheet = book.worksheets[0]
        rows = [[("" if cell is None else str(cell)) for cell in row] for row in sheet.iter_rows(values_only=True)]
        book.close()
    else:
        raise ValueError(f"unsupported bulk file type: {filename}")
    if not rows:
        raise ValueError("empty file")
    header = {str(cell).strip().lower(): i for i, cell in enumerate(rows[0])}
    for required in ("project_name", "application_name", "version", "repository_url"):
        if required not in header:
            raise ValueError(f"missing required column: {required}")
    out = []
    errors = []
    seen: dict[str, int] = {}
    for index, row in enumerate(rows[1:], start=2):
        if not any(str(cell).strip() for cell in row):
            continue

        def field(name: str) -> str:
            pos = header.get(name)
            if pos is None or pos >= len(row):
                return ""
            return str(row[pos]).strip()

        item = {
            "row_number": index,
            "project_name": field("project_name"),
            "application_name": field("application_name"),
            "version": field("version"),
            "repository_url": field("repository_url"),
            "branch": field("branch"),
            "authentication_reference": field("authentication_reference"),
            "scan_type": field("scan_type").upper() or "GITHUB",
        }
        row_errors = []
        if not item["project_name"]:
            row_errors.append({"row": index, "field": "project_name", "code": "MISSING_PROJECT_NAME", "message": "project_name is required"})
        if not item["application_name"]:
            row_errors.append({"row": index, "field": "application_name", "code": "MISSING_APPLICATION_NAME", "message": "application_name is required"})
        if not item["repository_url"]:
            row_errors.append({"row": index, "field": "repository_url", "code": "MISSING_REPOSITORY_URL", "message": "repository_url is required"})
        else:
            try:
                item["repository_url"] = canonical_github_url(item["repository_url"])
            except ValueError as exc:
                row_errors.append({"row": index, "field": "repository_url", "code": "INVALID_GITHUB_URL", "message": str(exc)})
        if item["scan_type"] != "GITHUB":
            row_errors.append({"row": index, "field": "scan_type", "code": "UNSUPPORTED_SCAN_TYPE", "message": "only GITHUB is supported for bulk"})
        if not row_errors:
            key = bulk_project_key(item["repository_url"], item["branch"])
            if key in seen:
                first = seen[key]
                branch = item["branch"] or "the default branch"
                row_errors.append(
                    {
                        "row": index,
                        "field": "repository_url",
                        "code": "DUPLICATE_PROJECT",
                        "message": (
                            f"Duplicate project of row {first}. "
                            f"{item['repository_url']} ({branch}) is already in this file, so this row is skipped."
                        ),
                    }
                )
            else:
                seen[key] = index
        errors.extend(row_errors)
        out.append(item)
    if not out:
        raise ValueError("empty file")
    return out, errors
