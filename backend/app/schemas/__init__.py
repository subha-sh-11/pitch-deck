"""Pydantic request/response schemas (mirror the frontend TS types, camelCase on the wire)."""
from app.schemas.user import UserCreate, UserRead
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectRead,
    ProjectSummary,
)
from app.schemas.intake import (
    IntakeFormData,
    IntakeUpdate,
    IntakeAnalysis,
    ExtractedScriptSummary,
)
from app.schemas.design import (
    DesignDirection,
    ColorToken,
    TypographyDirection,
    StoryAnalysis,
    QualityReview,
)
from app.schemas.slide import Slide, SlideContent, SlideLayout, SlideUpdate, DeckOutlineItem
from app.schemas.deck import DeckRead, TemplateSelect

__all__ = [
    "UserCreate",
    "UserRead",
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectRead",
    "ProjectSummary",
    "IntakeFormData",
    "IntakeUpdate",
    "IntakeAnalysis",
    "ExtractedScriptSummary",
    "DesignDirection",
    "ColorToken",
    "TypographyDirection",
    "StoryAnalysis",
    "QualityReview",
    "Slide",
    "SlideContent",
    "SlideLayout",
    "SlideUpdate",
    "DeckOutlineItem",
    "DeckRead",
    "TemplateSelect",
]
