"""Celery application (broker + result backend on Redis)."""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "pitchdeck",
    broker=settings.broker_url,
    backend=settings.result_backend,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_always_eager=settings.celery_eager,
    task_eager_propagates=settings.celery_eager,
    worker_max_tasks_per_child=50,
)
