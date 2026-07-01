"""Password hashing (bcrypt) + JWT encode/decode."""
from __future__ import annotations

import datetime as dt

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return _pwd.verify(password, password_hash)
    except ValueError:
        return False


def create_access_token(subject: str, *, extra: dict | None = None) -> str:
    """Signed JWT whose ``sub`` is the user id; expiry per config."""
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + dt.timedelta(minutes=settings.access_token_expire_minutes),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.nextauth_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    """Return the token payload, or None if invalid/expired."""
    try:
        return jwt.decode(token, settings.nextauth_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
