"""Archive extraction limits and outbound URL checks."""

from __future__ import annotations

import ipaddress
import os
import socket
import tarfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

class UnsafeArchive(Exception):
    pass


class UnsafeHost(Exception):
    pass


@dataclass(frozen=True)
class ExtractLimits:
    max_total: int
    max_entry: int
    max_files: int
    max_ratio: int


_BLOCKED_HOSTS = {
    "localhost",
    "metadata.google.internal",
    "metadata",
    "instance-data",
    "metadata.aws.internal",
    "kubernetes.default.svc",
    "kubernetes",
}

_EXTRA_NETS = [
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("169.254.169.254/32"),
]
# DNS64 publishes public IPv4 hosts inside this prefix. Python marks the whole prefix reserved.
_NAT64_WELL_KNOWN = ipaddress.ip_network("64:ff9b::/96")


def is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip in _NAT64_WELL_KNOWN:
        return is_blocked_ip(ipaddress.IPv4Address(ip.packed[-4:]))
    if (
        ip.is_loopback
        or ip.is_unspecified
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_private
        or ip.is_reserved
    ):
        return True
    return any(ip in net for net in _EXTRA_NETS)


def assert_safe_host(host: str) -> None:
    host = (host or "").lower().strip("[]")
    if not host or host in _BLOCKED_HOSTS:
        raise UnsafeHost("host is not permitted for outbound requests")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        if is_blocked_ip(literal):
            raise UnsafeHost("host is not permitted for outbound requests")
        return
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise UnsafeHost("host is not permitted for outbound requests") from exc
    if not infos:
        raise UnsafeHost("host is not permitted for outbound requests")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if is_blocked_ip(ip):
            raise UnsafeHost("host is not permitted for outbound requests")


def validate_outbound(raw: str, schemes: list[str], hosts: list[str]) -> None:
    parsed = urlparse(raw)
    if parsed.scheme.lower() not in {s.lower() for s in schemes}:
        raise UnsafeHost("host is not permitted for outbound requests")
    host = (parsed.hostname or "").lower()
    if hosts and host not in {h.lower() for h in hosts}:
        raise UnsafeHost("host is not permitted for outbound requests")
    assert_safe_host(host)


def _limits_ok(lim: ExtractLimits) -> None:
    if lim.max_total <= 0 or lim.max_entry <= 0 or lim.max_files <= 0 or lim.max_ratio <= 0:
        raise RuntimeError("extract limits must all be positive")


def safe_join(root: Path, name: str) -> Path:
    name = name.replace("\\", "/")
    if name.startswith("/") or ".." in name or ":" in name:
        raise UnsafeArchive(f"path traversal in {name!r}")
    dest = (root / Path(name)).resolve()
    root_abs = root.resolve()
    if os.path.commonpath([str(root_abs), str(dest)]) != str(root_abs):
        raise UnsafeArchive(f"path escapes root: {name!r}")
    return dest


def _copy_limited(src, dest: Path, limit: int) -> int:
    if dest.exists():
        raise UnsafeArchive(f"entry already exists {dest}")
    total = 0
    with dest.open("xb") as out:
        while True:
            chunk = src.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                raise UnsafeArchive(f"entry {dest.name!r} exceeds per-entry byte cap")
            out.write(chunk)
    return total


def extract_zip(archive: Path, dst: Path, lim: ExtractLimits) -> None:
    _limits_ok(lim)
    dst.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zf:
        infos = zf.infolist()
        if len(infos) > lim.max_files:
            raise UnsafeArchive(f"{len(infos)} files exceeds max {lim.max_files}")
        total = 0
        compressed = 0
        for info in infos:
            mode = (info.external_attr >> 16) & 0xFFFF
            if mode & 0o120000:
                raise UnsafeArchive(f"symlink entry {info.filename!r}")
            target = safe_join(dst, info.filename)
            if info.is_dir() or info.filename.endswith("/"):
                target.mkdir(parents=True, exist_ok=True)
                continue
            if info.file_size > lim.max_entry:
                raise UnsafeArchive(f"entry {info.filename!r} declared size {info.file_size} > max {lim.max_entry}")
            compressed += info.compress_size
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src:
                total += _copy_limited(src, target, lim.max_entry)
            if total > lim.max_total:
                raise UnsafeArchive(f"total uncompressed size exceeds max {lim.max_total}")
        if compressed > 0 and total // compressed > lim.max_ratio:
            raise UnsafeArchive(f"compression ratio {total // compressed} exceeds max {lim.max_ratio}")


def extract_tar_gz(archive: Path, dst: Path, lim: ExtractLimits) -> None:
    _limits_ok(lim)
    dst.mkdir(parents=True, exist_ok=True)
    total = 0
    count = 0
    with tarfile.open(archive, "r:gz") as tf:
        for member in tf:
            if member.type in (tarfile.XHDTYPE, tarfile.XGLTYPE, tarfile.GNUTYPE_LONGNAME, tarfile.GNUTYPE_LONGLINK):
                continue
            count += 1
            if count > lim.max_files:
                raise UnsafeArchive(f"file count exceeds max {lim.max_files}")
            if member.issym() or member.islnk() or not (member.isfile() or member.isdir()):
                raise UnsafeArchive(f"unsupported entry type for {member.name!r}")
            target = safe_join(dst, member.name)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            if member.size > lim.max_entry:
                raise UnsafeArchive(f"entry {member.name!r} size {member.size} > max {lim.max_entry}")
            target.parent.mkdir(parents=True, exist_ok=True)
            extracted = tf.extractfile(member)
            if extracted is None:
                raise UnsafeArchive(f"unreadable entry {member.name!r}")
            total += _copy_limited(extracted, target, lim.max_entry)
            if total > lim.max_total:
                raise UnsafeArchive(f"total uncompressed size exceeds {lim.max_total}")
