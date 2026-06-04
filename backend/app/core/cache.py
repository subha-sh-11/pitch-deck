"""Redis-backed cache (sync) used by the AI layer to avoid re-paying for identical generations.

Fail-open: if Redis is unreachable, caching becomes a no-op and the caller still works.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Callable

from app.core.config import settings

try:  # redis is optional at runtime
    import redis as _redis
except Exception:  # pragma: no cover
    _redis = None  # type: ignore

_client: "Any | None" = None
_disabled = False


def get_cache():
    """Lazy singleton sync Redis client, or None if unavailable."""
    global _client, _disabled
    if _disabled or _redis is None:
        return None
    if _client is None:
        try:
            _client = _redis.Redis.from_url(settings.redis_url, decode_responses=True)
            _client.ping()
        except Exception:
            _disabled = True
            _client = None
    return _client


def cache_key(prefix: str, payload: Any) -> str:
    blob = json.dumps(payload, sort_keys=True, default=str, ensure_ascii=False)
    digest = hashlib.sha256(blob.encode("utf-8")).hexdigest()[:32]
    return f"pd:{prefix}:{digest}"


def cache_get(key: str) -> Any | None:
    client = get_cache()
    if client is None:
        return None
    try:
        raw = client.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


def cache_set(key: str, value: Any, ttl: int = 86400) -> None:
    client = get_cache()
    if client is None:
        return
    try:
        client.set(key, json.dumps(value, default=str, ensure_ascii=False), ex=ttl)
    except Exception:
        pass


def cached_call(prefix: str, payload: Any, fn: Callable[[], Any], ttl: int = 86400) -> Any:
    """Return cached result for (prefix, payload), else compute via fn() and store it."""
    key = cache_key(prefix, payload)
    hit = cache_get(key)
    if hit is not None:
        return hit
    result = fn()
    cache_set(key, result, ttl)
    return result
