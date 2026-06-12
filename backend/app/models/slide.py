"""Slide model — aligned to the frontend's Slide contract (content/layout as JSONB)."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.deck import Deck


class Slide(Base, TimestampMixin):
    __tablename__ = "slides"

    id: Mapped[uuid.UUID] = uuid_pk()
    deck_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slide_number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # cover | logline | genre_blend | synopsis | story_world | character |
    # supporting_characters | usp | show_cross | visual_aesthetic | target_audience |
    # budget | market_potential | directors_vision | team | contact | generic
    slide_type: Mapped[str] = mapped_column(String(48), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    purpose: Mapped[str | None] = mapped_column(Text)
    content: Mapped[dict | None] = mapped_column(JSONB)  # SlideContent
    layout: Mapped[dict | None] = mapped_column(JSONB)   # SlideLayout
    # draft | approved | needs_review
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)
    # Editor metadata: speakerNotes, transition, appearance, comments (frontend Slide shape)
    meta: Mapped[dict | None] = mapped_column(JSONB)
    ai_rationale: Mapped[str | None] = mapped_column(Text)
    # The generated image bound to this slide (cover/world/character/mood), if any
    image_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", ondelete="SET NULL"), index=True
    )

    deck: Mapped["Deck"] = relationship(back_populates="slides")
    image_asset: Mapped["Asset | None"] = relationship(foreign_keys=[image_asset_id])
