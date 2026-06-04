"""SQLAlchemy models. Importing this package registers every table on `Base.metadata`."""
from app.models.base import Base
from app.models.user import User
from app.models.project import Project
from app.models.deck import Deck
from app.models.slide import Slide
from app.models.asset import Asset, GenerationJob

__all__ = [
    "Base",
    "User",
    "Project",
    "Deck",
    "Slide",
    "Asset",
    "GenerationJob",
]
