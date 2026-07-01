"""Auth endpoints: signup, login, current user."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthUser, LoginRequest, SignupRequest, TokenResponse
from app.auth.security import create_access_token
from app.core.db import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_for(user: User) -> TokenResponse:
    token = create_access_token(str(user.id), extra={"role": user.role})
    return TokenResponse(access_token=token, user=AuthUser.model_validate(user))


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    if await service.get_user_by_email(db, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    name = body.name or " ".join(p for p in (body.first_name, body.last_name) if p).strip() or None
    user = await service.create_user(db, email=body.email, password=body.password, name=name)
    return _token_for(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await service.authenticate(db, body.email, body.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return _token_for(user)


@router.get("/me", response_model=AuthUser)
async def me(user: User = Depends(get_current_user)) -> AuthUser:
    return AuthUser.model_validate(user)
