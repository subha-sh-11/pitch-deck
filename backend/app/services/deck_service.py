"""Deck reads + serialization to the frontend Deck shape (async session)."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Deck, Slide


async def get_deck_for_project(db: AsyncSession, project_id: uuid.UUID) -> Deck | None:
    stmt = (
        select(Deck)
        .where(Deck.project_id == project_id)
        .options(selectinload(Deck.slides))
        .order_by(Deck.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def serialize_slide(slide: Slide) -> dict:
    content = dict(slide.content or {})
    return {
        "id": str(slide.id),
        "slideNumber": slide.slide_number,
        "slideType": slide.slide_type,
        "title": slide.title or "",
        "purpose": slide.purpose or "",
        "content": content,
        "layout": slide.layout or {"template": slide.slide_type, "layoutType": "auto"},
        "status": slide.status,
        "aiRationale": slide.ai_rationale,
    }


def serialize_deck(deck: Deck) -> dict:
    design = dict(deck.design_direction or {})
    design.pop("_register", None)  # internal hint
    return {
        "id": str(deck.id),
        "projectId": str(deck.project_id),
        "templateId": deck.template_id,
        "slideCount": deck.slide_count,
        "status": deck.status,
        "designDirection": design or None,
        "slides": [serialize_slide(s) for s in sorted(deck.slides, key=lambda s: s.slide_number)],
    }
