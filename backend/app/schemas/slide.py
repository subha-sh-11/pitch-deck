"""Slide schemas (frontend src/types/slide.ts), extended with generated-image refs."""
from __future__ import annotations

from app.schemas.base import CamelModel, SlideStatus, SlideType


class CharacterBlock(CamelModel):
    name: str
    role: str
    description: str


class CompBlock(CamelModel):
    title: str
    note: str


class ItemBlock(CamelModel):
    title: str
    description: str


class MoodBlock(CamelModel):
    label: str
    color: str


class SlideContent(CamelModel):
    # Optional so the editor can PATCH partial content (e.g. just `edits` or `textBoxes`)
    # without resending the whole object; the update endpoint merges onto existing content.
    heading: str | None = None
    subheading: str | None = None
    body: str | None = None
    bullets: list[str] | None = None
    items: list[ItemBlock] | None = None
    characters: list[CharacterBlock] | None = None
    comps: list[CompBlock] | None = None
    mood_blocks: list[MoodBlock] | None = None
    # Extension: generated image bound to this slide (backend-only; prototype ignores it)
    image_url: str | None = None
    image_prompt: str | None = None
    # PPT-style editor: per-element overrides + free-form text boxes (opaque pass-through).
    edits: dict | None = None
    text_boxes: list[dict] | None = None


class SlideLayout(CamelModel):
    template: str
    layout_type: str


class Slide(CamelModel):
    id: str
    slide_number: int
    slide_type: SlideType
    title: str
    purpose: str
    content: SlideContent
    layout: SlideLayout
    status: SlideStatus = SlideStatus.draft
    ai_rationale: str | None = None


class SlideComment(CamelModel):
    id: str
    author: str
    text: str
    created_at: str


class SlideMeta(CamelModel):
    """Editor metadata persisted alongside content (frontend top-level Slide fields)."""

    speaker_notes: str | None = None
    transition: str | None = None
    appearance: dict | None = None
    comments: list[SlideComment] | None = None


class SlideUpdate(CamelModel):
    """Manual edits from the slide editor."""

    title: str | None = None
    content: SlideContent | None = None
    status: SlideStatus | None = None
    meta: SlideMeta | None = None


class SlideCreate(CamelModel):
    """A slide added from the editor (insert/duplicate)."""

    slide_type: SlideType
    slide_number: int  # desired 1-based position; existing slides at/after shift down
    title: str | None = None
    purpose: str | None = None
    content: SlideContent | None = None
    layout: SlideLayout | None = None


class DeckOutlineItem(CamelModel):
    slide_number: int
    title: str
    purpose: str
    required: bool
    slide_type: SlideType
