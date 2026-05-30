"""Vision document (confirmed creative intent) and intake session models."""
from __future__ import annotations

import datetime
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class VisionDocument(Base, TimestampMixin):
    """The heart of a project — the 5 Vision Unlocks, confirmed before generation."""

    __tablename__ = "vision_documents"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    # logline_only | partial_material | full_script
    user_state: Mapped[str | None] = mapped_column(String(32))
    # 5 Vision Unlocks: dramatic_engine, emotional_wounds, why_now, tone_anchors, signature_image
    vision: Mapped[dict | None] = mapped_column(JSONB)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confirmed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped["Project"] = relationship(back_populates="vision_document")


class IntakeSession(Base, TimestampMixin):
    __tablename__ = "intake_sessions"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Ordered conversation turns
    transcript: Mapped[list | None] = mapped_column(JSONB)
    detected_state: Mapped[str | None] = mapped_column(String(32))
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    project: Mapped["Project"] = relationship(back_populates="intake_sessions")
