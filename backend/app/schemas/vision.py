"""Vision document schemas (the 5 Vision Unlocks)."""
from __future__ import annotations

import datetime
import uuid

from pydantic import BaseModel

from app.schemas.base import ORMModel, UserState


class EmotionalWound(BaseModel):
    character: str
    wound: str


class ToneAnchor(BaseModel):
    title: str
    note: str | None = None


class VisionUnlocks(BaseModel):
    """The five elements that elevate a deck above generic output."""

    dramatic_engine: str | None = None
    emotional_wounds: list[EmotionalWound] | None = None
    why_now: str | None = None
    tone_anchors: list[ToneAnchor] | None = None
    signature_image: str | None = None


class VisionDocumentUpdate(BaseModel):
    user_state: UserState | None = None
    vision: VisionUnlocks | None = None
    confirmed: bool | None = None


class VisionDocumentRead(ORMModel):
    id: uuid.UUID
    project_id: uuid.UUID
    user_state: str | None
    vision: dict | None
    confirmed: bool
    confirmed_at: datetime.datetime | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
