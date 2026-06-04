"""Celery tasks — thin wrappers over the (self-contained) generation service."""
from __future__ import annotations

from app.services import generation_service
from app.workers.celery_app import celery_app


@celery_app.task(name="generate_deck")
def generate_deck_task(project_id: str, template_id: str | None = None,
                       job_id: str | None = None, with_images: bool = True):
    return generation_service.run_full_deck(project_id, template_id, job_id, with_images)


@celery_app.task(name="generate_design")
def generate_design_task(project_id: str, job_id: str | None = None):
    return generation_service.run_design(project_id, job_id)


@celery_app.task(name="regenerate_slide")
def regenerate_slide_task(slide_id: str, job_id: str | None = None):
    return generation_service.regenerate_slide(slide_id, job_id)
