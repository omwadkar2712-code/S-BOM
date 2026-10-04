"""API process entry point."""

from __future__ import annotations

import logging

import uvicorn

from .api import build
from .config import load


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    cfg = load()
    app = build(cfg)
    uvicorn.run(app, host=cfg.host, port=cfg.port, log_level=cfg.log_level.lower(), timeout_keep_alive=120)


if __name__ == "__main__":
    main()
