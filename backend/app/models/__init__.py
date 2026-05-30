"""SQLAlchemy models. Importing this package registers every table on `Base.metadata`."""
from app.models.base import Base
from app.models.user import User
from app.models.project import Project
from app.models.vision import VisionDocument, IntakeSession
from app.models.deck import DeckVariant, DeckVersion
from app.models.slide import Slide
from app.models.asset import Asset, GenerationJob
from app.models.review import ReviewFinding
from app.models.share import ShareLink, ViewEvent, Comment

__all__ = [
    "Base",
    "User",
    "Project",
    "VisionDocument",
    "IntakeSession",
    "DeckVariant",
    "DeckVersion",
    "Slide",
    "Asset",
    "GenerationJob",
    "ReviewFinding",
    "ShareLink",
    "ViewEvent",
    "Comment",
]
