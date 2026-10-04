"""In-process counters exposed on /health/ready and /metrics.json."""

from __future__ import annotations

from threading import Lock


class Metrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self.values = {
            "scans_total": 0,
            "scans_successful": 0,
            "scans_failed": 0,
            "scan_duration_sum_ms": 0,
            "scan_duration_count": 0,
            "queue_depth": 0,
            "worker_utilization": 0,
            "github_api_requests": 0,
            "github_api_rate_limit": 0,
            "components_discovered": 0,
            "vulnerabilities_discover": 0,
            "bulk_scans_total": 0,
        }

    def add(self, name: str, n: int = 1) -> None:
        with self._lock:
            self.values[name] = self.values.get(name, 0) + n

    def snapshot(self) -> dict[str, int]:
        with self._lock:
            return dict(self.values)


METRICS = Metrics()
