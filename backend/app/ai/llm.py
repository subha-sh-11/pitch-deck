"""Provider-agnostic text-LLM client.

The rest of the codebase never imports a vendor SDK directly — it calls `complete_json`.
Backends (Anthropic, OpenAI, or any future one) are lazily imported and selected via config.
If no provider is configured/reachable, the supplied deterministic `fallback` is returned, so
the whole pipeline runs offline with zero external calls.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable

from app.core.cache import cache_get, cache_key, cache_set
from app.core.config import settings
from app.core.logging import get_logger

_log = get_logger("llm")


# ─── Provider backends (each returns raw assistant text) ───

def _anthropic_complete(system: str, prompt: str, model: str, max_tokens: int, temp: float) -> str:
    from anthropic import Anthropic  # lazy

    client = Anthropic(api_key=settings.anthropic_api_key)
    msg = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temp,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=[
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": "{"},  # prefill to force JSON object
        ],
    )
    text = "".join(block.text for block in msg.content if getattr(block, "type", "") == "text")
    return "{" + text


def _openai_complete(system: str, prompt: str, model: str, max_tokens: int, temp: float) -> str:
    from openai import OpenAI  # lazy

    kwargs: dict[str, Any] = {"api_key": settings.openai_api_key}
    if settings.openai_base_url:
        kwargs["base_url"] = settings.openai_base_url
    client = OpenAI(**kwargs)
    resp = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temp,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    )
    return resp.choices[0].message.content or ""


_PROVIDERS: dict[str, tuple[Callable[..., str], str, str]] = {
    # name: (callable, api_key_attr, default_model_attr)
    "anthropic": (_anthropic_complete, "anthropic_api_key", "anthropic_default_model"),
    "openai": (_openai_complete, "openai_api_key", "openai_default_model"),
}


def resolve_provider() -> tuple[str, Callable[..., str], str] | None:
    """Return (name, callable, default_model) for the active provider, or None if offline."""
    if settings.ai_offline or settings.llm_provider == "none":
        return None

    if settings.llm_provider != "auto":
        entry = _PROVIDERS.get(settings.llm_provider)
        if entry and getattr(settings, entry[1], ""):
            return settings.llm_provider, entry[0], getattr(settings, entry[2])
        return None

    # auto: first provider with a configured key
    for name, (fn, key_attr, model_attr) in _PROVIDERS.items():
        if getattr(settings, key_attr, ""):
            return name, fn, getattr(settings, model_attr)
    return None


def provider_name() -> str:
    resolved = resolve_provider()
    return resolved[0] if resolved else "fallback"


# ─── JSON extraction ───

def _extract_json(text: str) -> Any:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    # grab the first balanced object/array
    match = re.search(r"[\{\[].*[\}\]]", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("no JSON found in LLM response")


# ─── Public API ───

def complete_json(
    *,
    system: str,
    prompt: str,
    fallback: Callable[[], Any],
    cache_prefix: str,
    model: str | None = None,
    max_tokens: int | None = None,
    temperature: float | None = None,
) -> Any:
    """Return parsed JSON from the active LLM, with caching and deterministic fallback."""
    resolved = resolve_provider()
    if resolved is None:
        _log.info("llm[%s] no provider → fallback", cache_prefix)
        return fallback()

    name, fn, default_model = resolved
    use_model = model or settings.llm_model or default_model
    key = cache_key(f"llm:{name}:{use_model}:{cache_prefix}", {"s": system, "p": prompt})
    hit = cache_get(key)
    if hit is not None:
        _log.info("llm[%s] cache hit", cache_prefix)
        return hit

    try:
        raw = fn(
            system,
            prompt,
            use_model,
            max_tokens or settings.llm_max_tokens,
            settings.llm_temperature if temperature is None else temperature,
        )
        result = _extract_json(raw)
        _log.info("llm[%s] %s/%s ok", cache_prefix, name, use_model)
    except Exception as exc:  # noqa: BLE001
        _log.warning("llm[%s] %s failed (%s) → fallback", cache_prefix, name, exc)
        return fallback()

    cache_set(key, result, ttl=86400)
    return result
