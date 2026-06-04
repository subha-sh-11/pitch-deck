"""Design direction schemas (frontend src/types/design.ts)."""
from __future__ import annotations

from pydantic import Field

from app.schemas.base import CamelModel


class ColorToken(CamelModel):
    name: str
    hex: str
    usage: str | None = None


class TypographyDirection(CamelModel):
    headings: str
    body: str
    accents: str
    treatment: str


class DesignDirection(CamelModel):
    mood: str
    cinematic_tone: str
    palette: list[ColorToken]
    typography: TypographyDirection
    visual_style: list[str]
    background_style: str
    image_style: str
    layout_style: str
    rationale: str


class StoryAnalysis(CamelModel):
    """Frontend src/types/workflow.ts StoryAnalysis."""

    core_theme: str
    emotional_core: str
    genre_dna: list[str]
    story_world: str
    commercial_angle: str
    audience_promise: str
    visual_world: str
    pitch_positioning: str


class QualityReviewFinding(CamelModel):
    slide_title: str
    status: str  # strong | needs_work | needs_detail
    suggestion: str


class QualityReview(CamelModel):
    overall_readiness: int = Field(ge=0, le=100)
    content_clarity: int = Field(ge=0, le=100)
    visual_consistency: int = Field(ge=0, le=100)
    investor_readiness: int = Field(ge=0, le=100)
    export_readiness: int = Field(ge=0, le=100)
    findings: list[QualityReviewFinding]
