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

# The most recent LLM failure reason (empty after any success), so the UI can show WHY a request
# fell back to deterministic output — a generic "can't reach the model" hides quota/key problems.
_last_error: str = ""


def last_error() -> str:
    """Reason the last LLM call fell back (e.g. 'openai (gpt-4o): … insufficient_quota'), or ''."""
    return _last_error


# ─── Provider backends (each returns raw assistant text) ───

def _anthropic_complete(system: str, prompt: str, model: str, max_tokens: int, temp: float,
                        images: list[dict] | None = None,
                        context: str | None = None) -> str:
    from anthropic import Anthropic  # lazy

    client = Anthropic(api_key=settings.anthropic_api_key)
    system_blocks: list[dict] = [
        {"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}
    ]
    if context:
        # Large per-project material (e.g. an uploaded script) goes in its own cached
        # block: later turns of the same conversation hit the prompt cache instead of
        # re-paying for the whole document.
        system_blocks.append(
            {"type": "text", "text": context, "cache_control": {"type": "ephemeral"}}
        )
    if images:
        content: Any = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img.get("mediaType", "image/jpeg"),
                    "data": img["data"],
                },
            }
            for img in images
        ]
        content.append({"type": "text", "text": prompt})
    else:
        content = prompt
    msg = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temp,
        system=system_blocks,
        messages=[
            {"role": "user", "content": content},
            {"role": "assistant", "content": "{"},  # prefill to force JSON object
        ],
    )
    text = "".join(block.text for block in msg.content if getattr(block, "type", "") == "text")
    return "{" + text


def _openai_complete(system: str, prompt: str, model: str, max_tokens: int, temp: float,
                     images: list[dict] | None = None,
                     context: str | None = None) -> str:
    from openai import OpenAI  # lazy

    kwargs: dict[str, Any] = {"api_key": settings.openai_api_key}
    if settings.openai_base_url:
        kwargs["base_url"] = settings.openai_base_url
    client = OpenAI(**kwargs)
    full_system = f"{system}\n\n{context}" if context else system
    if images:
        user_content: Any = [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img.get('mediaType', 'image/jpeg')};base64,{img['data']}",
                },
            }
            for img in images
        ]
        user_content.append({"type": "text", "text": prompt})
    else:
        user_content = prompt
    resp = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temp,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": full_system},
            {"role": "user", "content": user_content},
        ],
    )
    return resp.choices[0].message.content or ""


def _anthropic_complete_tools(system: str, prompt: str, model: str, max_tokens: int, temp: float,
                              tools: list[dict], images: list[dict] | None = None,
                              context: str | None = None) -> dict:
    """Native Anthropic tool use. Returns {"text": str, "tool_calls": [{"name", "arguments"}]}."""
    from anthropic import Anthropic  # lazy

    client = Anthropic(api_key=settings.anthropic_api_key)
    system_blocks: list[dict] = [
        {"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}
    ]
    if context:
        system_blocks.append(
            {"type": "text", "text": context, "cache_control": {"type": "ephemeral"}}
        )
    if images:
        content: Any = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img.get("mediaType", "image/jpeg"),
                    "data": img["data"],
                },
            }
            for img in images
        ]
        content.append({"type": "text", "text": prompt})
    else:
        content = prompt
    msg = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temp,
        system=system_blocks,
        tools=[
            {"name": t["name"], "description": t["description"], "input_schema": t["parameters"]}
            for t in tools
        ],
        messages=[{"role": "user", "content": content}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    calls = [
        {"name": b.name, "arguments": dict(b.input or {})}
        for b in msg.content
        if getattr(b, "type", "") == "tool_use"
    ]
    return {"text": text.strip(), "tool_calls": calls}


def _openai_complete_tools(system: str, prompt: str, model: str, max_tokens: int, temp: float,
                           tools: list[dict], images: list[dict] | None = None,
                           context: str | None = None) -> dict:
    """Native OpenAI function calling. Returns {"text": str, "tool_calls": [{"name", "arguments"}]}."""
    from openai import OpenAI  # lazy

    kwargs: dict[str, Any] = {"api_key": settings.openai_api_key}
    if settings.openai_base_url:
        kwargs["base_url"] = settings.openai_base_url
    client = OpenAI(**kwargs)
    full_system = f"{system}\n\n{context}" if context else system
    if images:
        user_content: Any = [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img.get('mediaType', 'image/jpeg')};base64,{img['data']}",
                },
            }
            for img in images
        ]
        user_content.append({"type": "text", "text": prompt})
    else:
        user_content = prompt
    resp = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temp,
        tools=[
            {"type": "function",
             "function": {"name": t["name"], "description": t["description"],
                          "parameters": t["parameters"]}}
            for t in tools
        ],
        tool_choice="auto",
        messages=[
            {"role": "system", "content": full_system},
            {"role": "user", "content": user_content},
        ],
    )
    m = resp.choices[0].message
    calls = []
    for tc in m.tool_calls or []:
        try:
            args = json.loads(tc.function.arguments or "{}")
        except Exception:  # noqa: BLE001 — one malformed call shouldn't sink the rest
            continue
        calls.append({"name": tc.function.name, "arguments": args if isinstance(args, dict) else {}})
    return {"text": (m.content or "").strip(), "tool_calls": calls}


_PROVIDERS: dict[str, tuple[Callable[..., str], str, str]] = {
    # name: (callable, api_key_attr, default_model_attr)
    "anthropic": (_anthropic_complete, "anthropic_api_key", "anthropic_default_model"),
    "openai": (_openai_complete, "openai_api_key", "openai_default_model"),
}

_TOOL_PROVIDERS: dict[str, Callable[..., dict]] = {
    "anthropic": _anthropic_complete_tools,
    "openai": _openai_complete_tools,
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
    use_cache: bool = True,
    images: list[dict] | None = None,
    context: str | None = None,
) -> Any:
    """Return parsed JSON from the active LLM, with caching and deterministic fallback.

    Set ``use_cache=False`` for conversational/non-deterministic calls (e.g. the intake
    interview) where every turn must be fresh — caching identical (system, prompt) pairs
    would make the agent repeat itself verbatim.
    """
    global _last_error
    resolved = resolve_provider()
    if resolved is None:
        _last_error = ("no AI text provider configured — set ANTHROPIC_API_KEY or OPENAI_API_KEY in "
                       "backend/.env (and LLM_PROVIDER=auto)")
        _log.info("llm[%s] no provider → fallback", cache_prefix)
        return fallback()

    name, fn, default_model = resolved
    use_model = model or settings.llm_model or default_model
    img_sig = [img.get("data", "")[:64] for img in images] if images else []
    ctx_sig = f"{len(context)}:{context[:128]}" if context else ""
    key = cache_key(
        f"llm:{name}:{use_model}:{cache_prefix}",
        {"s": system, "p": prompt, "i": img_sig, "c": ctx_sig},
    )
    if use_cache:
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
            images,
            context,
        )
        result = _extract_json(raw)
        _last_error = ""
        _log.info("llm[%s] %s/%s ok", cache_prefix, name, use_model)
    except Exception as exc:  # noqa: BLE001
        _last_error = f"{name} ({use_model}): {str(exc)[:200]}"
        _log.warning("llm[%s] %s failed (%s) → fallback", cache_prefix, name, exc)
        return fallback()

    if use_cache:
        cache_set(key, result, ttl=86400)
    return result


def complete_tools(
    *,
    system: str,
    prompt: str,
    tools: list[dict],
    fallback: Callable[[], Any],
    log_prefix: str,
    model: str | None = None,
    max_tokens: int | None = None,
    temperature: float | None = None,
    images: list[dict] | None = None,
    context: str | None = None,
) -> Any:
    """Call the active LLM with NATIVE tool/function calling; never cached (conversational).

    ``tools``: [{"name": str, "description": str, "parameters": <JSON schema>}] — translated
    to each provider's format (Anthropic tool use / OpenAI function calling). The model emits
    schema-validated calls instead of free-form JSON, which is far more reliable than asking
    for an actions blob in the prompt.

    Returns {"text": str, "tool_calls": [{"name": str, "arguments": dict}]} on success,
    otherwise ``fallback()`` (with the reason recorded for ``last_error``).
    """
    global _last_error
    resolved = resolve_provider()
    if resolved is None:
        _last_error = ("no AI text provider configured — set ANTHROPIC_API_KEY or OPENAI_API_KEY in "
                       "backend/.env (and LLM_PROVIDER=auto)")
        _log.info("llm-tools[%s] no provider → fallback", log_prefix)
        return fallback()

    name, _fn, default_model = resolved
    tool_fn = _TOOL_PROVIDERS.get(name)
    if tool_fn is None:  # provider without a tools backend — shouldn't happen, but degrade safely
        _last_error = f"{name}: tool calling not supported"
        return fallback()
    use_model = model or settings.llm_model or default_model
    try:
        result = tool_fn(
            system,
            prompt,
            use_model,
            max_tokens or settings.llm_max_tokens,
            settings.llm_temperature if temperature is None else temperature,
            tools,
            images,
            context,
        )
        _last_error = ""
        _log.info("llm-tools[%s] %s/%s ok (%d call(s))",
                  log_prefix, name, use_model, len(result.get("tool_calls", [])))
        return result
    except Exception as exc:  # noqa: BLE001
        _last_error = f"{name} ({use_model}): {str(exc)[:200]}"
        _log.warning("llm-tools[%s] %s failed (%s) → fallback", log_prefix, name, exc)
        return fallback()
