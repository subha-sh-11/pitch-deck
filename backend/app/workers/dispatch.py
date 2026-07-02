"""Dispatch generation work.

Phase-1 model (no Celery/Redis needed): run as a FastAPI BackgroundTask so the request
returns immediately and the client polls GET /jobs/{id} for progress. If Celery IS wired
(`celery_eager=false` and a broker is reachable), hand off to the worker instead.
Falls back to an inline threadpool run only when neither path is available.
"""
from __future__ import annotations

from typing import Callable

from fastapi import BackgroundTasks
from fastapi.concurrency import run_in_threadpool

from app.core.config import settings


async def dispatch(
    task_name: str,
    sync_fn: Callable,
    args: list,
    background_tasks: BackgroundTasks | None = None,
) -> str:
    """Return the dispatch mode: "queued" (Celery), "background" (BackgroundTask), or "inline"."""
    if not settings.celery_eager:
        try:
            from app.workers.celery_app import celery_app

            celery_app.send_task(task_name, args=args)
            return "queued"
        except Exception:
            pass  # broker unreachable / celery missing → run locally

    # Eager / no broker: run INLINE (the request waits and returns a finished job). We used to
    # use FastAPI BackgroundTasks here, but those left jobs stuck at "queued" — they run after
    # the response and swallow errors — so nothing ever generated. Inline is reliable.
    _ = background_tasks  # kept for signature compatibility; unused in eager mode
    await run_in_threadpool(sync_fn, *args)
    return "inline"
