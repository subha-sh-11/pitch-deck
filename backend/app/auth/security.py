"""Password hashing (bcrypt) + JWT encode/decode."""
from __future__ import annotations

import datetime as dt

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# bcrypt operates on at most 72 bytes and (since 5.0) RAISES on longer input
# instead of silently truncating — so we truncate here, matching bcrypt's classic
# behaviour. We use the `bcrypt` library directly rather than passlib, whose 1.7.x
# bcrypt backend is unmaintained and crashes against bcrypt>=4.1.
def _to_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(_to_bytes(password), password_hash.encode("utf-8"))
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
