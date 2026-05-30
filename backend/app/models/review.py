"""Structural review finding model."""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class ReviewFinding(Base, TimestampMixin):
    __tablename__ = "review_findings"

    id: Mapped[uuid.UUID] = uuid_pk()
    variant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_variants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slide_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("slides.id", ondelete="SET NULL"), index=True
    )
    # logline | character | tonal | format
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    severity: Mapped[str | None] = mapped_column(String(16))
    message: Mapped[str | None] = mapped_column(Text)
    suggested_fix: Mapped[dict | None] = mapped_column(JSONB)
    # accepted | modified | dismissed | open
    resolution: Mapped[str] = mapped_column(String(16), default="open", nullable=False)

    variant: Mapped["DeckVariant"] = relationship(back_populates="findings")
