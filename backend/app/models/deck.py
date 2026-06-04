"""Deck model — aligned to the frontend's Deck contract (one deck per project for now)."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.slide import Slide


class Deck(Base, TimestampMixin):
    __tablename__ = "decks"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_id: Mapped[str | None] = mapped_column(String(64))  # chosen PitchTemplate id
    slide_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # draft | outline_pending | content_pending | design_pending | ready | exported
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    design_direction: Mapped[dict | None] = mapped_column(JSONB)  # DesignDirection agent output
    quality_review: Mapped[dict | None] = mapped_column(JSONB)    # QualityReview agent output

    project: Mapped["Project"] = relationship(back_populates="decks")
    slides: Mapped[list["Slide"]] = relationship(
        back_populates="deck", cascade="all, delete-orphan",
        order_by="Slide.slide_number",
    )
