"""Provider-agnostic image generation.

Backends (fal.ai, Replicate, or any future one) are selected via config and lazily imported.
When none is available, a deterministic palette-driven SVG placeholder is produced so the deck
always renders a relevant image without external calls.
"""
from __future__ import annotations

import hashlib
import html
import logging
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


def _vertex_configured() -> bool:
    """Vertex needs a project + a service account (explicit path or ambient ADC)."""
    import os

    return bool(
        settings.vertex_project
        and (settings.vertex_credentials_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))
    )


def _resolve_image_provider() -> str:
    if settings.ai_offline or settings.image_provider == "none":
        return "placeholder"
    if settings.image_provider == "vertex":
        return "vertex" if _vertex_configured() else "placeholder"
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
    if _vertex_configured():
        return "vertex"
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


def _vertex_generate(prompt: str, aspect_ratio: str, seed: int | None) -> ImageResult:
    """Google Imagen via Vertex AI (:predict). Auth is a service-account OAuth token, NOT an API key.

    Credentials come from VERTEX_CREDENTIALS_PATH (a service-account .json) or, if that's blank,
    ambient Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS / gcloud auth).
    """
    import base64

    import os

    import google.auth
    import httpx
    from google.auth.transport.requests import Request

    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    # google.auth.default() transparently handles BOTH a service-account key and a gcloud ADC
    # (authorized_user) file — so we route any explicit path through GOOGLE_APPLICATION_CREDENTIALS
    # rather than assuming a service-account file.
    if settings.vertex_credentials_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.vertex_credentials_path
    creds, _ = google.auth.default(scopes=scopes)
    creds.refresh(Request())  # mints / refreshes the short-lived access token

    loc, proj, model = settings.vertex_location, settings.vertex_project, settings.vertex_image_model
    url = (
        f"https://{loc}-aiplatform.googleapis.com/v1/projects/{proj}"
        f"/locations/{loc}/publishers/google/models/{model}:predict"
    )
    params: dict[str, Any] = {
        "sampleCount": 1,
        "aspectRatio": _GOOGLE_ASPECT.get(aspect_ratio, "16:9"),
    }
    if seed is not None:
        # Vertex only allows a fixed seed when the watermark is off.
        params["seed"] = seed
        params["addWatermark"] = False
    body = {"instances": [{"prompt": prompt}], "parameters": params}
    headers = {"Authorization": f"Bearer {creds.token}"}
    # ADC (user) credentials need a billing/quota project; this header replaces
    # `gcloud auth application-default set-quota-project`.
    if proj:
        headers["x-goog-user-project"] = proj
    resp = httpx.post(url, json=body, headers=headers, timeout=120)
    if resp.status_code >= 400:
        # Surface Vertex's actual message (SERVICE_DISABLED / PERMISSION_DENIED / billing / model).
        raise ValueError(f"Vertex {resp.status_code} ({model} @ {loc}, proj={proj}): {resp.text[:600]}")
    payload = resp.json()
    preds = payload.get("predictions", [])
    if not preds or "bytesBase64Encoded" not in preds[0]:
        reason = preds[0].get("raiFilteredReason", "") if preds and isinstance(preds[0], dict) else ""
        raise ValueError(
            f"Vertex Imagen returned no image (safety filter?): {reason or str(payload)[:200]}"
        )
    data = base64.b64decode(preds[0]["bytesBase64Encoded"])
    mime = preds[0].get("mimeType", "image/png")
    return ImageResult(data, mime, {"provider": "vertex", "model": model, "prompt": prompt, "seed": seed})


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
