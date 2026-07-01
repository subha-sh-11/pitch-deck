"""Auth data layer: user lookup, creation, and credential verification."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import hash_password, verify_password
from app.models import User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email.lower().strip()))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def create_user(
    db: AsyncSession, *, email: str, password: str, name: str | None = None, role: str = "director",
) -> User:
    """Create a user with a hashed password. Caller must ensure the email is free."""
    user = User(
        email=email.lower().strip(),
        name=(name or "").strip() or None,
        role=role,
        password_hash=hash_password(password),
    )
    db.add(user)
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    """Return the user iff the email exists and the password matches."""
    user = await get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user
