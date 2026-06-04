"""Project model — aligned to the frontend's Project + IntakeFormData contracts."""
from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.deck import Deck
    from app.models.user import User


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = uuid_pk()
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # feature_film | web_series | short_film | documentary | pilot | other
    project_type: Mapped[str | None] = mapped_column(String(32))
    # investor | ott | studio | producer | festival | cast_crew | internal
    pitch_purpose: Mapped[str | None] = mapped_column(String(32))
    # raw_idea | one_line | synopsis_ready | partial_script | full_script | pilot_shot |
    # partially_shot | completed
    story_stage: Mapped[str | None] = mapped_column(String(32))
    genres: Mapped[list | None] = mapped_column(JSONB)          # list[str]
    tone: Mapped[list | None] = mapped_column(JSONB)            # list[str]
    language: Mapped[str | None] = mapped_column(String(64))
    # development | script_ready | pre_production | in_production | post_production
    production_status: Mapped[str | None] = mapped_column(String(32))
    # 9-phase workflow tracker: intake | questions | story_analysis | outline | content |
    # design | editor | review | export | completed
    status: Mapped[str] = mapped_column(String(32), default="intake", nullable=False, index=True)

    # The flat 20-field IntakeFormData captured by the setup wizard
    intake_form: Mapped[dict | None] = mapped_column(JSONB)
    # ExtractedScriptSummary from an uploaded script (PDF/DOCX/FDX)
    script_summary: Mapped[dict | None] = mapped_column(JSONB)
    # StoryAnalysis agent output
    story_analysis: Mapped[dict | None] = mapped_column(JSONB)

    last_edited_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped["User"] = relationship(back_populates="projects")
    decks: Mapped[list["Deck"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    assets: Mapped[list["Asset"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
