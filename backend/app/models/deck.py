"""Deck variant and version-history models."""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class DeckVariant(Base, TimestampMixin):
    """An audience-tailored deck (OTT / financier / talent) sharing one project."""

    __tablename__ = "deck_variants"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str | None] = mapped_column(String(120))  # "OTT version", "Financier version"
    slide_count: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    outline: Mapped[dict | None] = mapped_column(JSONB)           # Deck Outline Agent output
    design_direction: Mapped[dict | None] = mapped_column(JSONB)  # Design Direction Agent output
    layout_meta: Mapped[dict | None] = mapped_column(JSONB)       # ordering, expansions, overrides

    project: Mapped["Project"] = relationship(back_populates="variants")
    slides: Mapped[list["Slide"]] = relationship(
        back_populates="variant", cascade="all, delete-orphan"
    )
    versions: Mapped[list["DeckVersion"]] = relationship(
        back_populates="variant", cascade="all, delete-orphan"
    )
    findings: Mapped[list["ReviewFinding"]] = relationship(
        back_populates="variant", cascade="all, delete-orphan"
    )
    share_links: Mapped[list["ShareLink"]] = relationship(
        back_populates="variant", cascade="all, delete-orphan"
    )


class DeckVersion(Base, TimestampMixin):
    __tablename__ = "deck_versions"

    id: Mapped[uuid.UUID] = uuid_pk()
    variant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_variants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    snapshot: Mapped[dict | None] = mapped_column(JSONB)
    label: Mapped[str | None] = mapped_column(String(120))

    variant: Mapped["DeckVariant"] = relationship(back_populates="versions")
