"""Auth request/response schemas (camelCase on the wire, matching the frontend)."""
from __future__ import annotations

import datetime
import uuid

from pydantic import EmailStr, Field

from app.schemas.base import CamelModel


class SignupRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    first_name: str | None = None
    last_name: str | None = None
    name: str | None = None  # optional full name; else derived from first/last


class LoginRequest(CamelModel):
    email: EmailStr
    password: str


class AuthUser(CamelModel):
    id: uuid.UUID
    email: EmailStr
    name: str | None
    role: str
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TokenResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser
