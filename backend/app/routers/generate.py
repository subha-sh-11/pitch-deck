"""Generation endpoints — create a tracked job and dispatch the agent pipeline.

Rate-limited (AI cost protection). Each call creates a GenerationJob; work runs on a Celery
worker when available, otherwise inline. Poll GET /jobs/{id} for progress.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.rate_limit import ai_generate_limit, image_generate_limit
from app.models import Deck, GenerationJob, Project, Slide
from app.routers.deps import get_owned_project
from app.services import generation_service
from app.workers.dispatch import dispatch

router = APIRouter(prefix="/generate", tags=["generate"])


def _job_payload(job: GenerationJob, mode: str | None = None) -> dict:
    data = {
        "id": str(job.id),
        "jobType": job.job_type,
        "status": job.status,
        "progress": job.progress,
        "result": job.result,
        "error": job.error,
    }
    if mode:
        data["mode"] = mode
    return data


async def _create_job(db: AsyncSession, project_id: uuid.UUID, job_type: str,
                      params: dict | None = None) -> GenerationJob:
    job = GenerationJob(project_id=project_id, job_type=job_type, status="queued",
                        progress=0, params=params or {})
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@router.post("/{project_id}/deck", dependencies=[Depends(ai_generate_limit)])
async def generate_deck(
    background_tasks: BackgroundTasks,
    template_id: str | None = Query(default=None),
    with_images: bool = Query(default=True),
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    job = await _create_job(db, project.id, "full_deck", {"templateId": template_id})
    mode = await dispatch("generate_deck", generation_service.run_full_deck,
                          [str(project.id), template_id, str(job.id), with_images],
                          background_tasks)
    return _job_payload(job, mode)


@router.post("/{project_id}/design", dependencies=[Depends(ai_generate_limit)])
async def generate_design(
    background_tasks: BackgroundTasks,
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    job = await _create_job(db, project.id, "design")
    mode = await dispatch("generate_design", generation_service.run_design,
                          [str(project.id), str(job.id)], background_tasks)
    return _job_payload(job, mode)


@router.post("/slides/{slide_id}/regenerate", dependencies=[Depends(image_generate_limit)])
async def regenerate_slide(
    slide_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    slide = await db.get(Slide, slide_id)
    if slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")
    deck = await db.get(Deck, slide.deck_id)
    job = await _create_job(db, deck.project_id, "content", {"slideId": str(slide_id)})
    mode = await dispatch("regenerate_slide", generation_service.regenerate_slide,
                          [str(slide_id), str(job.id)], background_tasks)
    return _job_payload(job, mode)
