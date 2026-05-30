"""User schemas."""
from __future__ import annotations

import datetime
import uuid

from pydantic import BaseModel, EmailStr

from app.schemas.base import ORMModel


class UserCreate(BaseModel):
    email: EmailStr
    name: str | None = None
    role: str = "director"


class UserRead(ORMModel):
    id: uuid.UUID
    email: EmailStr
    name: str | None
    role: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
