"""User schemas."""
from __future__ import annotations

import datetime
import uuid

from pydantic import EmailStr

from app.schemas.base import CamelModel


class UserCreate(CamelModel):
    email: EmailStr
    name: str | None = None
    role: str = "director"


class UserRead(CamelModel):
    id: uuid.UUID
    email: EmailStr
    name: str | None
    role: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
