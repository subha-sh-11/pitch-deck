"""Authentication package.

Everything auth-related lives here so it can grow independently (OAuth, refresh tokens,
password reset, RBAC…) without touching the rest of the app:

- ``security``      — password hashing + JWT encode/decode
- ``schemas``       — request/response models (signup, login, token, user)
- ``service``       — user lookup, creation, credential verification
- ``dependencies``  — FastAPI deps (get_current_user / get_current_admin)
- ``router``        — the /auth endpoints (signup, login, me)
"""
from app.auth.dependencies import get_current_admin, get_current_user
from app.auth.router import router

__all__ = ["router", "get_current_user", "get_current_admin"]
