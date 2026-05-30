"""Slide model — content + layout live in JSONB, flexible per slide type."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class Slide(Base, TimestampMixin):
    __tablename__ = "slides"

    id: Mapped[uuid.UUID] = uuid_pk()
    variant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_variants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # title | logline_genre | world_hook | synopsis | character | mood_board | comps_audience |
    # budget_timeline | team | ask_status | season_arc | episode_structure | world_bible |
    # visual_treatment | footage_sizzle
    slide_type: Mapped[str] = mapped_column(String(48), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content: Mapped[dict | None] = mapped_column(JSONB)  # per-type content
    layout: Mapped[dict | None] = mapped_column(JSONB)   # Slide Layout Agent output
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    variant: Mapped["DeckVariant"] = relationship(back_populates="slides")
