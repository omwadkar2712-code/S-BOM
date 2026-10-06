"""Runtime configuration loaded from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse


def _env(key: str, default: str) -> str:
    value = os.environ.get(key)
    return value if value else default


def _int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _strip_scheme(url: str, scheme: str) -> str:
    rest = url[len(scheme) :]
    # local:///C:/abs leaves a leading slash before a Windows drive.
    if len(rest) >= 3 and rest[0] == "/" and rest[2] == ":":
        rest = rest[1:]
    return rest


def _csv(raw: str) -> list[str]:
    return [part.strip() for part in raw.split(",") if part.strip()]


@dataclass(frozen=True)
class Config:
    api_addr: str
    api_allow_origins: list[str]
    database_url: str
    object_storage_url: str
    credential_store: str
    credential_kek: str
    queue_poll_ms: int
    scanner_workers: int
    scan_timeout_seconds: int
    max_upload_bytes: int
    max_archive_uncompressed: int
    max_files_per_archive: int
    max_archive_entry_bytes: int
    archive_max_compression_ratio: int
    github_api_url: str
    github_timeout_seconds: int
    github_webhook_secret: str
    vuln_provider: str
    vuln_timeout_seconds: int
    mitre_api_url: str
    max_bulk_rows: int
    max_bulk_file_bytes: int
    log_level: str
    scanner_name: str = "bom-engine"
    scanner_version: str = "sbom-engine-1.0.0"

    @property
    def dialect(self) -> str:
        return "postgres"

    @property
    def postgres_dsn(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        return url

    @property
    def object_root(self) -> str:
        if not self.object_storage_url.startswith("local://"):
            raise RuntimeError("only local:// OBJECT_STORAGE_URL is supported")
        return _strip_scheme(self.object_storage_url, "local://")

    @property
    def host(self) -> str:
        addr = self.api_addr
        if addr.startswith(":"):
            return "127.0.0.1"
        host, _, _port = addr.rpartition(":")
        return host or "127.0.0.1"

    @property
    def port(self) -> int:
        addr = self.api_addr
        if addr.startswith(":"):
            return int(addr[1:])
        _host, _, port = addr.rpartition(":")
        return int(port or "8080")


def load() -> Config:
    cfg = Config(
        api_addr=_env("API_ADDR", "127.0.0.1:8080"),
        api_allow_origins=_csv(_env("API_ALLOW_ORIGINS", "")),
        database_url=_env("DATABASE_URL", "postgresql://sbom:sbom@127.0.0.1:5432/sbom"),
        object_storage_url=_env("OBJECT_STORAGE_URL", "local://./data/objects"),
        credential_store=_env("CREDENTIAL_STORE", "env"),
        credential_kek=_env("CREDENTIAL_KEK", ""),
        queue_poll_ms=_int("QUEUE_POLL_INTERVAL_MS", 500),
        scanner_workers=_int("SCANNER_WORKERS", 4),
        scan_timeout_seconds=_int("SCAN_TIMEOUT_SECONDS", 1800),
        max_upload_bytes=_int("MAX_UPLOAD_SIZE_BYTES", 1 << 30),
        max_archive_uncompressed=_int("MAX_ARCHIVE_UNCOMPRESSED_BYTES", 1 << 30),
        max_files_per_archive=_int("MAX_FILES_PER_ARCHIVE", 50000),
        max_archive_entry_bytes=_int("MAX_ARCHIVE_ENTRY_BYTES", 1 << 30),
        archive_max_compression_ratio=_int("ARCHIVE_MAX_COMPRESSION_RATIO", 100),
        github_api_url=_env("GITHUB_API_URL", "https://api.github.com"),
        github_timeout_seconds=_int("GITHUB_TIMEOUT_SECONDS", 30),
        github_webhook_secret=_env("GITHUB_WEBHOOK_SECRET", ""),
        vuln_provider=_env("VULN_PROVIDER", "mitre"),
        vuln_timeout_seconds=_int("VULN_PROVIDER_TIMEOUT_SECONDS", 20),
        mitre_api_url=_env("MITRE_CVE_API_URL", "https://cveawg.mitre.org/api"),
        max_bulk_rows=_int("MAX_BULK_ROWS", 5000),
        max_bulk_file_bytes=_int("MAX_BULK_FILE_BYTES", 50 * 1024 * 1024),
        log_level=_env("LOG_LEVEL", "info"),
    )
    if cfg.scanner_workers <= 0:
        raise RuntimeError("SCANNER_WORKERS must be > 0")
    if cfg.max_upload_bytes <= 0:
        raise RuntimeError("MAX_UPLOAD_SIZE_BYTES must be > 0")
    if cfg.credential_store == "env" and not cfg.credential_kek:
        raise RuntimeError("CREDENTIAL_KEK is required when CREDENTIAL_STORE=env")
    if cfg.vuln_provider.lower() == "mitre":
        parsed = urlparse(cfg.mitre_api_url)
        if parsed.scheme != "https" or (parsed.hostname or "").lower() != "cveawg.mitre.org":
            raise RuntimeError("MITRE_CVE_API_URL must be https://cveawg.mitre.org/api")
    if not (cfg.database_url.startswith("postgres://") or cfg.database_url.startswith("postgresql://")):
        raise RuntimeError("DATABASE_URL must start with postgresql://")
    if not cfg.object_storage_url.startswith("local://"):
        raise RuntimeError("OBJECT_STORAGE_URL must start with local://")
    return cfg
