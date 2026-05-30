"""Shared Pydantic base classes and enums."""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Response models read from SQLAlchemy ORM objects."""

    model_config = ConfigDict(from_attributes=True)


# ─── Controlled vocabularies (kept as str enums; DB stores plain text) ───

class ProjectFormat(str, Enum):
    feature = "feature"
    limited_series = "limited_series"
    ongoing_series = "ongoing_series"
    short = "short"


class ProjectStatus(str, Enum):
    draft = "draft"
    in_review = "in_review"
    completed = "completed"


class StyleRegister(str, Enum):
    restrained_cinematic = "restrained_cinematic"
    editorial_warm = "editorial_warm"
    high_contrast_genre = "high_contrast_genre"
    playful_bright = "playful_bright"
    pulp_stylized = "pulp_stylized"


class StartingPoint(str, Enum):
    logline = "logline"
    concept_note = "concept_note"
    treatment = "treatment"
    full_script = "full_script"


class ProjectType(str, Enum):
    film = "film"
    web_series = "web_series"
    short_film = "short_film"
    documentary = "documentary"


class PitchPurpose(str, Enum):
    investor = "investor"
    ott = "ott"
    studio = "studio"
    producer = "producer"
    festival = "festival"


class StoryStage(str, Enum):
    raw_idea = "raw_idea"
    partial_script = "partial_script"
    full_script = "full_script"
    shot_footage = "shot_footage"


class ProductionStatus(str, Enum):
    development = "development"
    pre_production = "pre_production"
    in_production = "in_production"
    post = "post"


class UserState(str, Enum):
    logline_only = "logline_only"
    partial_material = "partial_material"
    full_script = "full_script"
