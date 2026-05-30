"""Project model — the top-level creative container."""
from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = uuid_pk()
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Self-reference for duplicate/variant lineage (shared master_project_id).
    master_project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # feature | limited_series | ongoing_series | short
    format: Mapped[str | None] = mapped_column(String(32))
    # draft | in_review | completed
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False, index=True)
    # restrained_cinematic | editorial_warm | high_contrast_genre | playful_bright | pulp_stylized
    style_register: Mapped[str | None] = mapped_column(String(48))
    # logline | concept_note | treatment | full_script
    starting_point: Mapped[str | None] = mapped_column(String(32))

    # ─── Project setup fields (captured before intake) ───
    # film | web_series | short_film | documentary
    project_type: Mapped[str | None] = mapped_column(String(32))
    # investor | ott | studio | producer | festival
    pitch_purpose: Mapped[str | None] = mapped_column(String(32))
    # raw_idea | partial_script | full_script | shot_footage
    story_stage: Mapped[str | None] = mapped_column(String(32))
    language: Mapped[str | None] = mapped_column(String(48))
    genre: Mapped[list | None] = mapped_column(JSONB)
    tone: Mapped[str | None] = mapped_column(String(64))
    # development | pre_production | in_production | post
    production_status: Mapped[str | None] = mapped_column(String(32))

    # Normalized parsed input (raw_text, scenes, characters_detected, page_count, source_format)
    source_material: Mapped[dict | None] = mapped_column(JSONB)

    last_edited_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped["User"] = relationship(back_populates="projects")
    vision_document: Mapped["VisionDocument | None"] = relationship(
        back_populates="project", cascade="all, delete-orphan", uselist=False
    )
    intake_sessions: Mapped[list["IntakeSession"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    variants: Mapped[list["DeckVariant"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    assets: Mapped[list["Asset"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
