"""API process entry point."""

from __future__ import annotations

import logging
import os

import uvicorn

from app.api import build
from app.core.config import load


def create_app():
    return build(load())


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    cfg = load()
    # Reload so route/code changes apply without a full manual restart in local dev.
    reload = os.environ.get("API_RELOAD", "1").lower() not in {"0", "false", "no"}
    uvicorn.run(
        "app.main:create_app",
        factory=True,
        host=cfg.host,
        port=cfg.port,
        log_level=cfg.log_level.lower(),
        timeout_keep_alive=120,
        reload=reload,
    )


if __name__ == "__main__":
    main()
