"""Async per-IP rate limiting for expensive AI endpoints (fixed-window over Redis).

Fail-open: if Redis is unreachable, requests are allowed.
"""
from __future__ import annotations

from fastapi import HTTPException, Request, status

from app.core.config import settings

try:
    import redis.asyncio as _aredis
except Exception:  # pragma: no cover
    _aredis = None  # type: ignore

_aclient: "object | None" = None
_disabled = False


async def get_async_redis():
    global _aclient, _disabled
    if _disabled or _aredis is None:
        return None
    if _aclient is None:
        try:
            _aclient = _aredis.from_url(settings.redis_url, decode_responses=True)
            await _aclient.ping()
        except Exception:
            _disabled = True
            _aclient = None
    return _aclient


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """FastAPI dependency: limit `times` requests per `seconds` window, per IP + scope."""

    def __init__(self, times: int, seconds: int, scope: str = "default"):
        self.times = times
        self.seconds = seconds
        self.scope = scope

    async def __call__(self, request: Request) -> None:
        client = await get_async_redis()
        if client is None:
            return  # fail-open
        ip = _client_ip(request)
        key = f"pd:rl:{self.scope}:{ip}"
        try:
            current = await client.incr(key)
            if current == 1:
                await client.expire(key, self.seconds)
            if current > self.times:
                ttl = await client.ttl(key)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Retry in {max(ttl, 1)}s.",
                    headers={"Retry-After": str(max(ttl, 1))},
                )
        except HTTPException:
            raise
        except Exception:
            return  # fail-open on Redis errors


# Pre-built limiters for AI routes (tune as needed)
ai_generate_limit = RateLimiter(times=20, seconds=60, scope="ai_generate")
image_generate_limit = RateLimiter(times=10, seconds=60, scope="ai_image")
