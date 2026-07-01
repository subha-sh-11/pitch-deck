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


class QualityReviewIssue(CamelModel):
    """One problem the quality-review agent found (mirrors ai/agents/quality_review.run())."""
    severity: str  # high | medium | low
    category: str  # repeated_images | missing_producer_slide | readability | generic_copy | …
    message: str
    slide_number: int | None = None
    slide_type: str | None = None


class QualityReview(CamelModel):
    """Structural QA over the finished deck (stored on Deck.quality_review)."""
    score: int = Field(ge=0, le=100)
    summary: str
    issues: list[QualityReviewIssue]
    checked_at: str | None = None
