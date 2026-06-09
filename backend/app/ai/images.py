"""Provider-agnostic image generation.

Backends (fal.ai, Replicate, or any future one) are selected via config and lazily imported.
When none is available, a deterministic palette-driven SVG placeholder is produced so the deck
always renders a relevant image without external calls.
"""
from __future__ import annotations

import hashlib
import html
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from app.core.config import settings

_log = logging.getLogger("pitchdeck.images")

ASPECT_DIMENSIONS = {
    "21:9": (1680, 720),
    "16:9": (1280, 720),
    "4:3": (1024, 768),
    "1:1": (1024, 1024),
    "3:4": (768, 1024),
}


@dataclass
class ImageResult:
    data: bytes
    mime: str
    meta: dict[str, Any] = field(default_factory=dict)


_PROVIDER_KEY = {
    "fal": "fal_key",
    "replicate": "replicate_api_token",
    "google": "google_api_key",
}


def _resolve_image_provider() -> str:
    if settings.ai_offline or settings.image_provider == "none":
        return "placeholder"
    # Vertex authenticates via ADC (no key) — only needs a project configured.
    if settings.image_provider == "vertex":
        return "vertex" if settings.vertex_project else "placeholder"
    if settings.image_provider in _PROVIDER_KEY:
        has_key = bool(getattr(settings, _PROVIDER_KEY[settings.image_provider]))
        return settings.image_provider if has_key else "placeholder"
    # auto
    if settings.vertex_project:
        return "vertex"
    if settings.fal_key:
        return "fal"
    if settings.replicate_api_token:
        return "replicate"
    if settings.google_api_key:
        return "google"
    return "placeholder"


def generate_image(
    prompt: str,
    *,
    aspect_ratio: str = "16:9",
    palette: list[dict] | None = None,
    negative_prompt: str = "text, watermark, logo, signature, deformed",
    seed: int | None = None,
    label: str = "",
) -> ImageResult:
    provider = _resolve_image_provider()
    w, h = ASPECT_DIMENSIONS.get(aspect_ratio, ASPECT_DIMENSIONS["16:9"])
    try:
        if provider == "fal":
            return _fal_generate(prompt, w, h, negative_prompt, seed)
        if provider == "replicate":
            return _replicate_generate(prompt, w, h, negative_prompt, seed)
        if provider == "vertex":
            return _vertex_generate(prompt, aspect_ratio, seed)
        if provider == "google":
            return _google_generate(prompt, aspect_ratio, seed)
    except Exception as exc:  # noqa: BLE001
        _log.warning("image provider %r failed, using placeholder: %s", provider, exc)
    return _placeholder(prompt or label, w, h, palette or [])


# Imagen supports a fixed set of aspect ratios; map ours onto the nearest.
_GOOGLE_ASPECT = {"21:9": "16:9", "16:9": "16:9", "4:3": "4:3", "1:1": "1:1", "3:4": "3:4"}

# Cached ADC credentials for Vertex (refreshed lazily when the token expires).
_vertex_creds = None


def _vertex_token() -> str:
    """OAuth token from Application Default Credentials (gcloud auth application-default login)."""
    global _vertex_creds
    import google.auth
    import google.auth.transport.requests

    if _vertex_creds is None:
        _vertex_creds, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    if not _vertex_creds.valid:
        _vertex_creds.refresh(google.auth.transport.requests.Request())
    return _vertex_creds.token


def _vertex_generate(prompt: str, aspect_ratio: str, seed: int | None) -> ImageResult:
    """Google Imagen via Vertex AI (ADC auth, billed to the configured GCP project)."""
    import base64

    import httpx

    project = settings.vertex_project
    location = settings.vertex_location
    model = settings.google_image_model
    url = (
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}"
        f"/locations/{location}/publishers/google/models/{model}:predict"
    )
    body = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": _GOOGLE_ASPECT.get(aspect_ratio, "16:9"),
            # Cinematic realism for film pitches: least-restrictive standard filter and
            # allow adult figures (still blocks minors + the most graphic content).
            "safetySetting": "block_only_high",
            "personGeneration": "allow_adult",
        },
    }
    # Imagen has a per-minute rate limit; a full deck generates many images at once, so
    # retry transient 429/503 with exponential backoff instead of falling back to placeholder.
    for attempt in range(4):
        resp = httpx.post(
            url,
            headers={"Authorization": f"Bearer {_vertex_token()}"},
            json=body,
            timeout=120,
        )
        if resp.status_code in (429, 503) and attempt < 3:
            wait = 4 * (2 ** attempt)  # 4s, 8s, 16s
            _log.warning("vertex imagen %s (rate limit), retry %d in %ds",
                         resp.status_code, attempt + 1, wait)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        preds = resp.json().get("predictions", [])
        if not preds or "bytesBase64Encoded" not in preds[0]:
            reason = ""
            if preds and isinstance(preds[0], dict):
                reason = preds[0].get("raiFilteredReason", "")
            raise ValueError(f"Vertex Imagen returned no image (safety filter?): {reason}")
        data = base64.b64decode(preds[0]["bytesBase64Encoded"])
        mime = preds[0].get("mimeType", "image/png")
        return ImageResult(data, mime, {"provider": "vertex", "model": model,
                                        "prompt": prompt, "seed": seed})
    raise RuntimeError("Vertex Imagen rate-limited after retries")


def _google_generate(prompt: str, aspect_ratio: str, seed: int | None) -> ImageResult:
    """Google Imagen via the Gemini API (generativelanguage) :predict endpoint."""
    import base64

    import httpx

    model = settings.google_image_model
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:predict"
        f"?key={settings.google_api_key}"
    )
    body = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": _GOOGLE_ASPECT.get(aspect_ratio, "16:9"),
        },
    }
    resp = httpx.post(url, json=body, timeout=120)
    resp.raise_for_status()
    payload = resp.json()
    preds = payload.get("predictions", [])
    if not preds or "bytesBase64Encoded" not in preds[0]:
        reason = ""
        if preds and isinstance(preds[0], dict):
            reason = preds[0].get("raiFilteredReason", "")
        if not reason:
            reason = str(payload.get("filteredReason") or payload)[:200]
        raise ValueError(f"Imagen returned no image (safety filter?): {reason}")
    data = base64.b64decode(preds[0]["bytesBase64Encoded"])
    mime = preds[0].get("mimeType", "image/png")
    return ImageResult(data, mime, {"provider": "google", "model": model,
                                    "prompt": prompt, "seed": seed})


def _fetch_bytes(url: str) -> tuple[bytes, str]:
    import httpx

    resp = httpx.get(url, timeout=120)
    resp.raise_for_status()
    return resp.content, resp.headers.get("content-type", "image/png")


def _fal_generate(prompt: str, w: int, h: int, neg: str, seed: int | None) -> ImageResult:
    import fal_client  # lazy

    import os

    os.environ.setdefault("FAL_KEY", settings.fal_key)
    result = fal_client.run(
        settings.fal_image_model,
        arguments={
            "prompt": prompt,
            "image_size": {"width": w, "height": h},
            **({"seed": seed} if seed is not None else {}),
        },
    )
    url = result["images"][0]["url"]
    data, mime = _fetch_bytes(url)
    return ImageResult(data, mime, {"provider": "fal", "model": settings.fal_image_model,
                                    "prompt": prompt, "seed": seed})


def _replicate_generate(prompt: str, w: int, h: int, neg: str, seed: int | None) -> ImageResult:
    import replicate  # lazy

    client = replicate.Client(api_token=settings.replicate_api_token)
    out = client.run(
        settings.replicate_image_model,
        input={"prompt": prompt, "width": w, "height": h,
               **({"seed": seed} if seed is not None else {})},
    )
    url = out[0] if isinstance(out, (list, tuple)) else str(out)
    data, mime = _fetch_bytes(url)
    return ImageResult(data, mime, {"provider": "replicate",
                                    "model": settings.replicate_image_model,
                                    "prompt": prompt, "seed": seed})


def _placeholder(prompt: str, w: int, h: int, palette: list[dict]) -> ImageResult:
    """Deterministic SVG: a gradient built from the deck palette + a caption from the prompt."""
    colors = [c.get("hex") for c in palette if c.get("hex")] or ["#0B0B0D", "#1E1F22", "#B8862F"]
    # deterministic angle/order from prompt so the same slide is stable across runs
    h_seed = int(hashlib.sha256(prompt.encode("utf-8")).hexdigest(), 16)
    angle = h_seed % 360
    stops = "".join(
        f'<stop offset="{int(i * 100 / max(len(colors) - 1, 1))}%" stop-color="{html.escape(c)}"/>'
        for i, c in enumerate(colors)
    )
    caption = html.escape((prompt[:60] + "…") if len(prompt) > 60 else prompt)
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate({angle})">{stops}</linearGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.06"/></feComponentTransfer></filter>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#g)"/>
  <rect width="{w}" height="{h}" filter="url(#n)" opacity="0.5"/>
  <rect width="{w}" height="{h}" fill="black" opacity="0.18"/>
  <text x="40" y="{h - 40}" font-family="Georgia, serif" font-size="{max(14, w // 48)}"
        fill="#FFFFFF" opacity="0.82">{caption}</text>
</svg>"""
    return ImageResult(svg.encode("utf-8"), "image/svg+xml",
                       {"provider": "placeholder", "prompt": prompt})
