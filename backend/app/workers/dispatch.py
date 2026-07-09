"""Dispatch generation work.

Phase-1 model (no Celery/Redis needed): run as a FastAPI BackgroundTask so the request
returns immediately and the client polls GET /jobs/{id} for progress. If Celery IS wired
(`celery_eager=false` and a broker is reachable), hand off to the worker instead.
Falls back to an inline threadpool run only when neither path is available.
"""
from __future__ import annotations

import threading
from typing import Callable

from fastapi import BackgroundTasks

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("dispatch")


async def dispatch(
    task_name: str,
    sync_fn: Callable,
    args: list,
    background_tasks: BackgroundTasks | None = None,
) -> str:
    """Return the dispatch mode: "queued" (Celery worker) or "thread" (in-process background)."""
    if not settings.celery_eager:
        try:
            from app.workers.celery_app import celery_app

            celery_app.send_task(task_name, args=args)
            return "queued"
        except Exception:
            log.warning("celery broker unreachable — running %s in a local thread", task_name)

    # No worker (free-tier / eager): run in a BACKGROUND THREAD so the request returns immediately
    # and the client polls GET /jobs/{id}. Blocking inline would exceed the ~100s HTTP timeout on
    # long generations; FastAPI BackgroundTasks ran after the response and swallowed errors. A plain
    # daemon thread runs independently and the task manages its own job record + errors.
    _ = background_tasks  # unused; kept for signature compatibility

    def _run() -> None:
        try:
            sync_fn(*args)
        except Exception:  # noqa: BLE001 — the task marks the job failed; log for visibility
            log.exception("background task %s failed", task_name)

    threading.Thread(target=_run, name=f"gen-{task_name}", daemon=True).start()
    return "thread"
