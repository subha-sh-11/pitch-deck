"""Deck reads + serialization to the frontend Deck shape (async session)."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Deck, Slide


async def _renumber(db: AsyncSession, deck: Deck) -> None:
    """Reassign slide_number 1..n in current order and sync slide_count. No commit."""
    stmt = select(Slide).where(Slide.deck_id == deck.id).order_by(Slide.slide_number)
    slides = (await db.execute(stmt)).scalars().all()
    for i, s in enumerate(slides, start=1):
        s.slide_number = i
    deck.slide_count = len(slides)


async def create_slide(db: AsyncSession, deck: Deck, data: dict) -> Slide:
    """Insert a slide at the requested 1-based position; shifts later slides down."""
    position = max(1, int(data.get("slide_number") or 1))
    stmt = select(Slide).where(Slide.deck_id == deck.id, Slide.slide_number >= position)
    for s in (await db.execute(stmt)).scalars():
        s.slide_number += 1
    slide = Slide(
        deck_id=deck.id,
        slide_number=position,
        slide_type=data["slide_type"],
        title=data.get("title"),
        purpose=data.get("purpose"),
        content=data.get("content"),
        layout=data.get("layout") or {"template": data["slide_type"], "layoutType": "auto"},
        status="draft",
    )
    db.add(slide)
    await db.flush()
    await _renumber(db, deck)
    await db.commit()
    await db.refresh(slide)
    return slide


async def delete_slide(db: AsyncSession, slide: Slide) -> None:
    deck = await db.get(Deck, slide.deck_id)
    await db.delete(slide)
    await db.flush()
    if deck is not None:
        await _renumber(db, deck)
    await db.commit()


async def reorder_slides(db: AsyncSession, deck: Deck, ordered_ids: list[uuid.UUID]) -> None:
    """Apply the editor's order. Ids not in the list keep relative order at the end."""
    stmt = select(Slide).where(Slide.deck_id == deck.id).order_by(Slide.slide_number)
    slides = (await db.execute(stmt)).scalars().all()
    rank = {sid: i for i, sid in enumerate(ordered_ids)}
    slides.sort(key=lambda s: (rank.get(s.id, len(ordered_ids)), s.slide_number))
    for i, s in enumerate(slides, start=1):
        s.slide_number = i
    deck.slide_count = len(slides)
    await db.commit()


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
    meta = dict(slide.meta or {})
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
        # Editor metadata lives flat on the frontend Slide shape
        "speakerNotes": meta.get("speakerNotes"),
        "transition": meta.get("transition"),
        "appearance": meta.get("appearance"),
        "comments": meta.get("comments"),
        # Workshop: the editable prompts behind this slide + whether it's been generated
        "prompts": meta.get("prompts"),
        "generated": bool(meta.get("generated")),
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
