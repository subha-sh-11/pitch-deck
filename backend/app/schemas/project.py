"""Project schemas (mirrors frontend src/types/project.ts + intake)."""
from __future__ import annotations

import datetime
import uuid

from pydantic import Field

from app.schemas.base import (
    CamelModel,
    PitchPurpose,
    ProductionStatus,
    ProjectStatus,
    ProjectType,
    StoryStage,
)
from app.schemas.intake import IntakeFormData


class ProjectCreate(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    project_type: ProjectType | None = None
    pitch_purpose: PitchPurpose | None = None
    story_stage: StoryStage | None = None
    genres: list[str] = Field(default_factory=list)
    tone: list[str] = Field(default_factory=list)
    language: str | None = None
    production_status: ProductionStatus | None = None


class ProjectUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    project_type: ProjectType | None = None
    pitch_purpose: PitchPurpose | None = None
    story_stage: StoryStage | None = None
    genres: list[str] | None = None
    tone: list[str] | None = None
    language: str | None = None
    production_status: ProductionStatus | None = None
    status: ProjectStatus | None = None


class ProjectSummary(CamelModel):
    """Dashboard list shape (frontend Project)."""

    id: uuid.UUID
    title: str
    project_type: str | None
    pitch_purpose: str | None
    story_stage: str | None
    genres: list[str] | None
    tone: list[str] | None
    language: str | None
    production_status: str | None
    status: str
    updated_at: datetime.datetime


class ProjectRead(ProjectSummary):
    owner_id: uuid.UUID
    intake_form: IntakeFormData | None
    script_summary: dict | None
    story_analysis: dict | None
    last_edited_at: datetime.datetime | None
    created_at: datetime.datetime
