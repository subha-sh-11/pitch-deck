"""Deck + slide read/edit endpoints."""
from __future__ import annotations

import base64
import uuid
from functools import partial

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.ai.agents import design_candidates, slide_edit
from app.core.db import get_db
from app.core.storage import load_asset_bytes
from app.models import Asset, Deck, Project, Slide
from app.routers.deps import get_owned_project
from app.schemas.slide import SlideCreate, SlideUpdate
from app.services import deck_service

router = APIRouter(tags=["decks"])


class DeckCommand(BaseModel):
    """A natural-language deck-editing instruction + the current slides (as the editor sees them)."""

    instruction: str
    slides: list[dict] = Field(default_factory=list)
    # Recent chat turns [{"role": "user"|"assistant", "text": str}] so the agent can resolve
    # follow-ups ("9th", "that slide") against its own previous question.
    history: list[dict] = Field(default_factory=list)
    # The slide the director currently has open in the workshop — the default edit target.
    selected_slide_id: str | None = Field(default=None, alias="selectedSlideId")
    # Reference images shared this turn ([{"name","mediaType","data": <base64>}]) the agent
    # analyses to adapt the deck's look. Capped/cleaned defensively.
    images: list[dict] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


_MAX_IMAGES = 4
_MAX_IMAGE_B64 = 4_000_000  # ~3 MB binary per image


def _clean_images(images: list[dict]) -> list[dict] | None:
    cleaned = [
        {
            "name": str(img.get("name", "reference"))[:120],
            "mediaType": str(img.get("mediaType", "image/jpeg")),
            "data": img["data"],
        }
        for img in images
        if isinstance(img, dict)
        and isinstance(img.get("data"), str)
        and 0 < len(img["data"]) <= _MAX_IMAGE_B64
    ][:_MAX_IMAGES]
    return cleaned or None


@router.post("/projects/{project_id}/deck/command")
async def deck_command(
    body: DeckCommand,
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Turn a director's instruction into structured edit actions the editor applies live.

    This is the agent action layer: the chat drives real changes to the deck. The LLM call is
    blocking, so it runs off the event loop; results are sanitized to safe, well-formed actions.
    The agent gets the project's full grounding context — completed brief, pitch purpose, deck
    design and uploaded script — so it interprets requests against the source material instead
    of guessing from slide fragments.
    """
    deck = (await db.execute(
        select(Deck).where(Deck.project_id == project.id).limit(1)
    )).scalar_one_or_none()
    design = {k: v for k, v in ((deck.design_direction if deck else {}) or {}).items()
              if k != "_register"}
    run = partial(
        slide_edit.run,
        body.instruction,
        body.slides,
        body.history,
        body.selected_slide_id,
        _clean_images(body.images),
        intake=project.intake_form or {},
        design=design,
        purpose=project.pitch_purpose,
        script=project.script_text,
    )
    result = await run_in_threadpool(run)
    return slide_edit.sanitize(result if isinstance(result, dict) else {}, body.slides)


class DesignApply(BaseModel):
    """A chosen visual-system candidate to apply deck-wide."""

    design: dict = Field(default_factory=dict)


async def _reference_images(db: AsyncSession, project_id, limit: int = 4) -> list[dict] | None:
    """Director's visual-direction references as [{"mediaType","data": <base64>}] so the design
    agent can match them. Async mirror of generation_service._load_reference_images."""
    rows = (await db.execute(
        select(Asset).where(Asset.project_id == project_id, Asset.kind == "upload_ref")
    )).scalars().all()
    refs: list[dict] = []
    for a in rows:
        meta = a.generation_meta or {}
        if meta.get("source") != "visual_direction":
            continue
        data = await run_in_threadpool(load_asset_bytes, a.storage_key, meta.get("stored_in_s3"))
        if not data:
            continue
        refs.append({"mediaType": a.mime or "image/jpeg",
                     "data": base64.b64encode(data).decode("ascii")})
        if len(refs) >= limit:
            break
    return refs or None


@router.post("/projects/{project_id}/design/candidates")
async def design_candidates_endpoint(
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate 4-5 distinct, story-grounded visual systems for the director to choose from.
    When the director has uploaded visual references, they steer at least one candidate.

    Synchronous (one LLM call returning all candidates) — runs off the event loop.
    """
    proj = {"genres": project.genres or [], "tone": project.tone or []}
    refs = await _reference_images(db, project.id)
    return await run_in_threadpool(design_candidates.run, proj, project.intake_form or {}, refs)


@router.put("/projects/{project_id}/deck/design")
async def set_deck_design(
    body: DesignApply,
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    """Apply a chosen visual system to the deck so every slide (and future generation) uses it."""
    deck = await _get_deck_or_404(db, project.id)
    deck.design_direction = body.design
    await db.commit()
    refreshed = await deck_service.get_deck_for_project(db, project.id)
    return deck_service.serialize_deck(refreshed) if refreshed else {"ok": True}


@router.get("/projects/{project_id}/deck")
async def get_deck(
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    deck = await deck_service.get_deck_for_project(db, project.id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No deck generated yet")
    return deck_service.serialize_deck(deck)


@router.patch("/slides/{slide_id}")
async def update_slide(
    slide_id: uuid.UUID,
    data: SlideUpdate,
    db: AsyncSession = Depends(get_db),
):
    slide = await db.get(Slide, slide_id)
    if slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")
    if data.title is not None:
        slide.title = data.title
    if data.content is not None:
        # preserve any baked image fields not present in the incoming edit
        merged = dict(slide.content or {})
        merged.update(data.content.model_dump(by_alias=True, exclude_none=True))
        slide.content = merged
    if data.status is not None:
        slide.status = data.status.value
    if data.meta is not None:
        # merge so a notes-only patch doesn't wipe appearance, and vice versa
        merged_meta = dict(slide.meta or {})
        merged_meta.update(data.meta.model_dump(by_alias=True, exclude_none=True))
        slide.meta = merged_meta
    await db.commit()
    await db.refresh(slide)
    return deck_service.serialize_slide(slide)


class SlideOrder(BaseModel):
    """The editor's slide order, as a list of slide ids (first = slide 1)."""

    slide_ids: list[uuid.UUID] = Field(default_factory=list, alias="slideIds")

    model_config = {"populate_by_name": True}


async def _get_deck_or_404(db: AsyncSession, project_id: uuid.UUID):
    deck = await deck_service.get_deck_for_project(db, project_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No deck generated yet")
    return deck


@router.post("/projects/{project_id}/deck/slides", status_code=status.HTTP_201_CREATED)
async def create_slide(
    data: SlideCreate,
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    """Persist a slide added in the editor (insert or duplicate)."""
    deck = await _get_deck_or_404(db, project.id)
    payload = data.model_dump(exclude_none=True)
    if data.content is not None:
        payload["content"] = data.content.model_dump(by_alias=True, exclude_none=True)
    if data.layout is not None:
        payload["layout"] = data.layout.model_dump(by_alias=True)
    slide = await deck_service.create_slide(db, deck, payload)
    return deck_service.serialize_slide(slide)


@router.delete("/slides/{slide_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_slide(
    slide_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    slide = await db.get(Slide, slide_id)
    if slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")
    await deck_service.delete_slide(db, slide)


@router.post("/projects/{project_id}/deck/assemble")
async def assemble_deck(
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    """Workshop final step: every slide approved → the deck becomes the presentation."""
    deck = await _get_deck_or_404(db, project.id)
    slides = (await db.execute(
        select(Slide).where(Slide.deck_id == deck.id)
    )).scalars().all()
    not_approved = [s.slide_number for s in slides if s.status != "approved"]
    if not_approved:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Slides not yet approved: {sorted(not_approved)}",
        )
    deck.status = "ready"
    project.status = "editor"
    await db.commit()
    refreshed = await deck_service.get_deck_for_project(db, project.id)
    return deck_service.serialize_deck(refreshed)


@router.post("/projects/{project_id}/deck/slides/reorder")
async def reorder_slides(
    body: SlideOrder,
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    """Persist the editor's slide order."""
    deck = await _get_deck_or_404(db, project.id)
    await deck_service.reorder_slides(db, deck, body.slide_ids)
    refreshed = await deck_service.get_deck_for_project(db, project.id)
    return deck_service.serialize_deck(refreshed) if refreshed else {"ok": True}
