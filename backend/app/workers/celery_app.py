"""Celery application (broker + result backend on Redis)."""
from __future__ import annotations

import ssl

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

# TLS Redis (Upstash and other managed providers use rediss://). Celery/kombu require an explicit
# ssl_cert_reqs or they raise on startup — redis-py (the cache client) handles rediss:// on its own.
if settings.broker_url.startswith("rediss://"):
    celery_app.conf.broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}
if settings.result_backend.startswith("rediss://"):
    celery_app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}
