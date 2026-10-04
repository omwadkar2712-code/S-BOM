"""Worker process. Claims queued scans and runs the pipeline."""

from __future__ import annotations

import logging
import signal
import threading
import time

from .api import build
from .config import load
from .metrics import METRICS
from .orchestrator import RetryableError, ScanCancelled, next_attempt


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    app = build(load())
    orch = app.state.orch
    queue = orch.queue
    cfg = app.state.cfg
    stop = threading.Event()

    def handle_stop(*_args):
        stop.set()

    signal.signal(signal.SIGINT, handle_stop)
    signal.signal(signal.SIGTERM, handle_stop)

    def loop(worker_id: int) -> None:
        while not stop.is_set():
            try:
                job = queue.claim(cfg.scan_timeout_seconds)
            except Exception:
                logging.exception("queue claim failed")
                stop.wait(cfg.queue_poll_ms / 1000)
                continue
            if job is None:
                stop.wait(cfg.queue_poll_ms / 1000)
                continue
            claimed = orch.scans.get_scan(job["scan_id"])
            if claimed is not None and claimed["status"] == "CANCELLED":
                queue.mark_cancelled(job["id"])
                continue
            METRICS.add("scans_total")
            started = time.time()
            try:
                orch.execute(job)
                queue.complete(job["id"])
                METRICS.add("scans_successful")
            except ScanCancelled:
                queue.mark_cancelled(job["id"])
            except RetryableError as exc:
                METRICS.add("scans_failed")
                queue.fail(job["id"], "SCAN_FAILED", str(exc), True, next_attempt(job["attempts"]))
            except Exception as exc:
                METRICS.add("scans_failed")
                queue.fail(job["id"], "SCAN_FAILED", str(exc), False, next_attempt(job["attempts"]))
            METRICS.add("scan_duration_sum_ms", int((time.time() - started) * 1000))
            METRICS.add("scan_duration_count")
            logging.info("worker %s finished %s", worker_id, job["scan_id"])

    threads = [threading.Thread(target=loop, args=(i,), daemon=True) for i in range(cfg.scanner_workers)]
    for thread in threads:
        thread.start()
    logging.info("worker started workers=%s", cfg.scanner_workers)
    stop.wait()
    logging.info("worker stopping")


if __name__ == "__main__":
    main()
