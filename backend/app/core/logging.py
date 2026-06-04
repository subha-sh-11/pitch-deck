"""Verbose, readable logging for the whole app (every request + every pipeline step)."""
from __future__ import annotations

import logging
import sys

_CONFIGURED = False


def setup_logging(level: int = logging.INFO) -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    # Windows consoles default to cp1252 and choke on ✓/→ etc. — force UTF-8, replace on error.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-5s [%(name)s] %(message)s", datefmt="%H:%M:%S"
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(fmt)

    # Our app namespace — always visible regardless of uvicorn's log level.
    app_logger = logging.getLogger("pitchdeck")
    app_logger.setLevel(level)
    app_logger.handlers = [handler]
    app_logger.propagate = False

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a child logger under the 'pitchdeck' namespace."""
    return logging.getLogger(f"pitchdeck.{name}")
