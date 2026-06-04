"""Intake schemas — the flat 20-field IntakeFormData (frontend src/types/workflow.ts)."""
from __future__ import annotations

from pydantic import Field

from app.schemas.base import CamelModel


class IntakeFormData(CamelModel):
    title: str = ""
    tagline: str = ""
    logline: str = ""
    genre_blend: str = ""
    tone: str = ""
    synopsis: str = ""
    story_world: str = ""
    main_characters: str = ""
    character_dynamics: str = ""
    usp: str = ""
    show_cross: str = ""
    target_audience: str = ""
    release_fit: str = ""
    visual_aesthetic: str = ""
    color_palette: str = ""
    texture_style: str = ""
    design_direction: str = ""
    themes: str = ""
    key_scenes: str = ""
    visual_mood: str = ""


class ExtractedField(CamelModel):
    label: str
    value: str


class ExtractedScriptSummary(CamelModel):
    file_name: str
    fields: list[ExtractedField]


class IntakeUpdate(CamelModel):
    """Partial intake update from the setup wizard."""

    form: IntakeFormData


class IntakeExtractResult(CamelModel):
    """Fields auto-extracted from an uploaded script, for the user to review."""

    file_name: str
    form: IntakeFormData
    filled_fields: list[str]


class FollowUpQuestion(CamelModel):
    question: str
    placeholder: str


class IntakeAnalysis(CamelModel):
    completeness_score: int = Field(ge=0, le=100)
    detected_signals: list[ExtractedField]
    missing_details: list[str]
    follow_up_questions: list[FollowUpQuestion]
