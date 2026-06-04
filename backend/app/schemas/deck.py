"""Deck schemas (mirrors frontend src/types/deck.ts)."""
from __future__ import annotations

import uuid

from app.schemas.base import CamelModel, DeckStatus
from app.schemas.design import DesignDirection
from app.schemas.slide import Slide


class DeckRead(CamelModel):
    id: uuid.UUID
    project_id: uuid.UUID
    template_id: str | None = None
    slide_count: int
    status: DeckStatus
    slides: list[Slide]
    design_direction: DesignDirection | None = None


class TemplateSelect(CamelModel):
    template_id: str
