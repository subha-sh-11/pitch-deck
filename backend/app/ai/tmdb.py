"""TMDB lookups for real comparable-film posters (Show Cross slide).

Optional: requires TMDB_API_KEY. Without it, poster_for() returns None and the UI
falls back to a styled card. Results are cached.
"""
from __future__ import annotations

from app.core.cache import cached_call
from app.core.config import settings
from app.core.logging import get_logger

_log = get_logger("tmdb")
_IMG_BASE = "https://image.tmdb.org/t/p/w500"


def poster_for(title: str) -> str | None:
    """Return a poster image URL for a film title, or None if unavailable."""
    if not settings.tmdb_api_key or not title.strip():
        return None

    def _lookup() -> str:
        import httpx

        try:
            resp = httpx.get(
                "https://api.themoviedb.org/3/search/movie",
                params={"api_key": settings.tmdb_api_key, "query": title, "include_adult": "false"},
                timeout=15,
            )
            resp.raise_for_status()
            for result in resp.json().get("results", []):
                if result.get("poster_path"):
                    return _IMG_BASE + result["poster_path"]
        except Exception as exc:  # noqa: BLE001
            _log.warning("tmdb lookup failed for %r: %s", title, exc)
        return ""  # cache the miss too (empty string)

    url = cached_call("tmdb:poster", {"t": title.lower().strip()}, _lookup, ttl=604800)
    return url or None
