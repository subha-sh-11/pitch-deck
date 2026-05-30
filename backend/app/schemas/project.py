"""Project schemas."""
from __future__ import annotations

import datetime
import uuid

from pydantic import BaseModel, Field

from app.schemas.base import (
    ORMModel,
    PitchPurpose,
    ProductionStatus,
    ProjectFormat,
    ProjectStatus,
    ProjectType,
    StartingPoint,
    StoryStage,
    StyleRegister,
)


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    starting_point: StartingPoint | None = None
    format: ProjectFormat | None = None
    style_register: StyleRegister | None = None
    # Project setup fields
    project_type: ProjectType | None = None
    pitch_purpose: PitchPurpose | None = None
    story_stage: StoryStage | None = None
    language: str | None = None
    genre: list[str] | None = None
    tone: str | None = None
    production_status: ProductionStatus | None = None


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: ProjectStatus | None = None
    format: ProjectFormat | None = None
    style_register: StyleRegister | None = None
    project_type: ProjectType | None = None
    pitch_purpose: PitchPurpose | None = None
    story_stage: StoryStage | None = None
    language: str | None = None
    genre: list[str] | None = None
    tone: str | None = None
    production_status: ProductionStatus | None = None


class ProjectSummary(ORMModel):
    """Lightweight shape for the dashboard list."""

    id: uuid.UUID
    title: str
    format: str | None
    status: str
    style_register: str | None
    last_edited_at: datetime.datetime | None
    updated_at: datetime.datetime


class ProjectRead(ProjectSummary):
    owner_id: uuid.UUID
    master_project_id: uuid.UUID | None
    starting_point: str | None
    project_type: str | None
    pitch_purpose: str | None
    story_stage: str | None
    language: str | None
    genre: list[str] | None
    tone: str | None
    production_status: str | None
    source_material: dict | None
    created_at: datetime.datetime
