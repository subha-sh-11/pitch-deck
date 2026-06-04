"""Shared Pydantic base classes and controlled vocabularies (mirrors the frontend)."""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base for all API models — serializes to camelCase to match the frontend TS types."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ─── Project vocabularies (frontend src/types/project.ts) ───

class ProjectType(str, Enum):
    feature_film = "feature_film"
    web_series = "web_series"
    short_film = "short_film"
    documentary = "documentary"
    pilot = "pilot"
    other = "other"


class PitchPurpose(str, Enum):
    investor = "investor"
    ott = "ott"
    studio = "studio"
    producer = "producer"
    festival = "festival"
    cast_crew = "cast_crew"
    internal = "internal"


class StoryStage(str, Enum):
    raw_idea = "raw_idea"
    one_line = "one_line"
    synopsis_ready = "synopsis_ready"
    partial_script = "partial_script"
    full_script = "full_script"
    pilot_shot = "pilot_shot"
    partially_shot = "partially_shot"
    completed = "completed"


class ProductionStatus(str, Enum):
    development = "development"
    script_ready = "script_ready"
    pre_production = "pre_production"
    in_production = "in_production"
    post_production = "post_production"


class ProjectStatus(str, Enum):
    intake = "intake"
    questions = "questions"
    story_analysis = "story_analysis"
    outline = "outline"
    content = "content"
    design = "design"
    editor = "editor"
    review = "review"
    export = "export"
    completed = "completed"


# ─── Slide vocabularies (frontend src/types/slide.ts) ───

class SlideType(str, Enum):
    cover = "cover"
    logline = "logline"
    genre_blend = "genre_blend"
    synopsis = "synopsis"
    story_world = "story_world"
    character = "character"
    supporting_characters = "supporting_characters"
    usp = "usp"
    show_cross = "show_cross"
    visual_aesthetic = "visual_aesthetic"
    target_audience = "target_audience"
    budget = "budget"
    market_potential = "market_potential"
    directors_vision = "directors_vision"
    team = "team"
    contact = "contact"
    generic = "generic"


class SlideStatus(str, Enum):
    draft = "draft"
    approved = "approved"
    needs_review = "needs_review"


class DeckStatus(str, Enum):
    draft = "draft"
    outline_pending = "outline_pending"
    content_pending = "content_pending"
    design_pending = "design_pending"
    ready = "ready"
    exported = "exported"
