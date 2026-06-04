"""Deck + slide read/edit endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import Project, Slide
from app.routers.deps import get_owned_project
from app.schemas.slide import SlideUpdate
from app.services import deck_service

router = APIRouter(tags=["decks"])


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
    await db.commit()
    await db.refresh(slide)
    return deck_service.serialize_slide(slide)
