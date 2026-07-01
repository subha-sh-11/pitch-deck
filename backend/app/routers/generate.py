"""Generation endpoints — create a tracked job and dispatch the agent pipeline.

Rate-limited (AI cost protection). Each call creates a GenerationJob; work runs on a Celery
worker when available, otherwise inline. Poll GET /jobs/{id} for progress.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
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


@router.post("/{project_id}/analyze", dependencies=[Depends(ai_generate_limit)])
async def analyze_story(
    project: Project = Depends(get_owned_project),
):
    """Story Blueprint: compute + persist the AI's StoryAnalysis from the current intake WITHOUT
    generating slides, so the director can review the AI's understanding before building."""
    return await run_in_threadpool(generation_service.run_story_analysis, str(project.id))


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


class WorkshopGenerateBody(BaseModel):
    """Workshop per-slide generation — every knob the director can turn is editable."""

    instructions: str | None = None   # director's notes to the content agent
    imagePrompt: str | None = None    # edited diffusion prompt (used verbatim)
    contentPrompt: str | None = None  # the FULL writer prompt, edited (used verbatim)
    withImage: bool = True


class ImageRegenBody(BaseModel):
    prompt: str | None = None         # edited diffusion prompt; blank → rebuild from design


@router.post("/{project_id}/deck/prepare", dependencies=[Depends(ai_generate_limit)])
async def prepare_deck(
    background_tasks: BackgroundTasks,
    template_id: str | None = Query(default=None),
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    """Workshop step 1: analysis + design + outline → empty slide shells (no batch generation)."""
    job = await _create_job(db, project.id, "prepare_deck", {"templateId": template_id})
    mode = await dispatch("prepare_deck", generation_service.prepare_deck,
                          [str(project.id), template_id, str(job.id)], background_tasks)
    return _job_payload(job, mode)


@router.post("/slides/{slide_id}/regenerate", dependencies=[Depends(image_generate_limit)])
async def regenerate_slide(
    slide_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    body: WorkshopGenerateBody | None = None,
    db: AsyncSession = Depends(get_db),
):
    slide = await db.get(Slide, slide_id)
    if slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")
    deck = await db.get(Deck, slide.deck_id)
    job = await _create_job(db, deck.project_id, "content", {"slideId": str(slide_id)})
    b = body or WorkshopGenerateBody()
    mode = await dispatch("regenerate_slide", generation_service.regenerate_slide,
                          [str(slide_id), str(job.id), b.withImage,
                           b.instructions, b.imagePrompt, b.contentPrompt],
                          background_tasks)
    return _job_payload(job, mode)


@router.get("/slides/{slide_id}/prompt")
async def get_slide_prompt(
    slide_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """The EXACT prompt that will be sent to the LLM to prepare this slide.

    Returns the director-edited version when one is stored; otherwise composes the
    real prompt from the slide brief + intake + design — same code path generation uses.
    """
    from app.ai.agents import content as content_agent

    slide = await db.get(Slide, slide_id)
    if slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")
    deck = await db.get(Deck, slide.deck_id)
    project = await db.get(Project, deck.project_id)
    meta = dict(slide.meta or {})
    stored = ((meta.get("prompts") or {}).get("contentPrompt") or "").strip()
    if stored:
        return {"prompt": stored, "source": "edited"}
    design = {k: v for k, v in (deck.design_direction or {}).items() if k != "_register"}
    prompt = content_agent.compose_prompt(
        slide.slide_type, slide.title or "", slide.purpose or "",
        project.intake_form or {}, design,
        instructions=(meta.get("prompts") or {}).get("contentInstructions"),
    )
    return {"prompt": prompt, "source": "composed"}


@router.post("/slides/{slide_id}/image", dependencies=[Depends(image_generate_limit)])
async def workshop_slide_image(
    slide_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    body: ImageRegenBody | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Workshop: regenerate ONLY the image as a tracked job, optionally from an edited prompt."""
    slide = await db.get(Slide, slide_id)
    if slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")
    deck = await db.get(Deck, slide.deck_id)
    job = await _create_job(db, deck.project_id, "image", {"slideId": str(slide_id)})
    mode = await dispatch("regenerate_slide_image", generation_service.regenerate_slide_image,
                          [str(slide_id), str(job.id), (body.prompt if body else None)],
                          background_tasks)
    return _job_payload(job, mode)


@router.post("/slides/{slide_id}/regenerate-image", dependencies=[Depends(image_generate_limit)])
async def regenerate_slide_image(
    slide_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Regenerate only the image for a slide (synchronous). Keeps text/edits intact."""
    slide = await db.get(Slide, slide_id)
    if slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")
    return await run_in_threadpool(generation_service.regenerate_slide_image, str(slide_id))


@router.post("/slides/{slide_id}/image-variants", dependencies=[Depends(image_generate_limit)])
async def slide_image_variants(
    slide_id: uuid.UUID,
    body: ImageRegenBody | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Generate 3 image options for a slide (gallery). Optionally from an edited prompt."""
    slide = await db.get(Slide, slide_id)
    if slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")
    return await run_in_threadpool(
        generation_service.generate_slide_image_variants,
        str(slide_id), None, (body.prompt if body else None), 3,
    )


@router.post("/{project_id}/slide-image", dependencies=[Depends(image_generate_limit)])
async def generate_slide_image(
    slide_type: str = Query(...),
    project: Project = Depends(get_owned_project),
):
    """Generate an image for a slide TYPE (for editor-added slides with no DB row)."""
    return await run_in_threadpool(
        generation_service.generate_project_image, str(project.id), slide_type
    )
