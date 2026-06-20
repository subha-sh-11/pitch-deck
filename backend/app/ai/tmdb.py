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
_BACKDROP_BASE = "https://image.tmdb.org/t/p/w780"


def _search_image(title: str, path_key: str, base: str, cache_prefix: str) -> str | None:
    """Shared TMDB title search → an image URL for the given path field (poster or backdrop).

    Uses TMDB's official API (the licensed source for film poster/still imagery); returns None
    when no key is configured or no match is found."""
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
                if result.get(path_key):
                    return base + result[path_key]
        except Exception as exc:  # noqa: BLE001
            _log.warning("tmdb %s lookup failed for %r: %s", path_key, title, exc)
        return ""  # cache the miss too (empty string)

    url = cached_call(cache_prefix, {"t": title.lower().strip()}, _lookup, ttl=604800)
    return url or None


def poster_for(title: str) -> str | None:
    """A poster image URL for a film title (Show Cross comparables), or None if unavailable."""
    return _search_image(title, "poster_path", _IMG_BASE, "tmdb:poster")


def backdrop_for(title: str) -> str | None:
    """A wide backdrop/still URL for a film title — used as a real visual reference on the Visual
    Aesthetic moodboard. Returns None when no key/match (the pipeline then renders an AI mood frame)."""
    return _search_image(title, "backdrop_path", _BACKDROP_BASE, "tmdb:backdrop")
