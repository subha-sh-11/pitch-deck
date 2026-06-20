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
    # Normalise: tolerate stray whitespace / casing in IMAGE_PROVIDER.
    provider = (settings.image_provider or "").strip().lower()
    if settings.ai_offline or provider == "none":
        return "placeholder"
    # "gemini" / "nano-banana" name a MODEL, not a backend. People naturally set
    # IMAGE_PROVIDER=gemini; route it to the right Google backend instead of silently falling
    # through to a placeholder: Vertex when a service account is configured, else the API-key path.
    if provider in ("gemini", "nano-banana", "nanobanana", "google-gemini"):
        if _vertex_configured():
            return "vertex"
        if settings.google_api_key:
            return "google"
        return "placeholder"
    if provider == "vertex":
        return "vertex" if _vertex_configured() else "placeholder"
    if provider in _PROVIDER_KEY:
        has_key = bool(getattr(settings, _PROVIDER_KEY[provider]))
        return provider if has_key else "placeholder"
    # auto (and any unrecognised value) → first available backend
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


# Prepended to the prompt when the director supplied reference images, so the model treats
# them as a STYLE guide for new art rather than something to copy literally.
_REF_STYLE_PREAMBLE = (
    "Use the attached reference image(s) as the VISUAL STYLE GUIDE for brand-new, original key art: "
    "match their colour palette, lighting, grain/texture and graphic treatment (framing, composition, "
    "typographic mood, any film-strip / poster motifs). Render THIS film's subject described below — "
    "do NOT copy the reference's people, faces, or any text/letters that appear in them.\n\n"
)


def _gemini_parts(prompt: str, reference_images: list[dict] | None) -> list[dict]:
    """Build Gemini `contents[].parts`: reference images first (as inlineData), then the text."""
    parts: list[dict] = []
    text = prompt
    if reference_images:
        text = _REF_STYLE_PREAMBLE + prompt
        for ref in reference_images[:4]:
            data = ref.get("data")
            if not data:
                continue
            parts.append(
                {"inlineData": {"mimeType": ref.get("mediaType", "image/jpeg"), "data": data}}
            )
    parts.append({"text": text})
    return parts


def generate_image(
    prompt: str,
    *,
    aspect_ratio: str = "16:9",
    palette: list[dict] | None = None,
    negative_prompt: str = "text, watermark, logo, signature, deformed",
    seed: int | None = None,
    label: str = "",
    reference_images: list[dict] | None = None,
) -> ImageResult:
    """Generate one image. ``reference_images`` ([{"mediaType", "data": <base64>}]) are the
    director's visual references; on Gemini image models they condition the output (style/palette/
    grade). Providers without image-input support ignore them gracefully and stay text-only."""
    provider = _resolve_image_provider()
    w, h = ASPECT_DIMENSIONS.get(aspect_ratio, ASPECT_DIMENSIONS["16:9"])
    reason = "" if provider != "placeholder" else "no_image_provider_configured"
    try:
        if provider == "fal":
            return _fal_generate(prompt, w, h, negative_prompt, seed, reference_images)
        if provider == "replicate":
            return _replicate_generate(prompt, w, h, negative_prompt, seed)
        if provider == "vertex":
            return _vertex_generate(prompt, aspect_ratio, seed, reference_images)
        if provider == "google":
            return _google_generate(prompt, aspect_ratio, seed, reference_images)
    except Exception as exc:  # noqa: BLE001
        # Surface WHY real generation failed: logged here AND recorded in the placeholder's meta
        # (→ asset.generation_meta) so the reason is visible without grepping server logs.
        _log.warning("image provider %r failed, using placeholder: %s", provider, exc)
        reason = f"{provider}_error: {exc}"[:300]
    return _placeholder(prompt or label, w, h, palette or [], reason=reason)


# Imagen supports a fixed set of aspect ratios; map ours onto the nearest.
_GOOGLE_ASPECT = {"21:9": "16:9", "16:9": "16:9", "4:3": "4:3", "1:1": "1:1", "3:4": "3:4"}


def _google_gemini_generate(prompt: str, aspect_ratio: str, seed: int | None,
                            model: str, reference_images: list[dict] | None = None) -> ImageResult:
    """Gemini image models via the API-key (generativelanguage) :generateContent endpoint."""
    import base64

    import httpx

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        f"?key={settings.google_api_key}"
    )
    generation_config: dict[str, Any] = {
        "responseModalities": ["IMAGE"],
        "imageConfig": {"aspectRatio": _GOOGLE_ASPECT.get(aspect_ratio, "16:9")},
    }
    if seed is not None:
        generation_config["seed"] = seed
    body = {
        "contents": [{"role": "user", "parts": _gemini_parts(prompt, reference_images)}],
        "generationConfig": generation_config,
    }
    resp = httpx.post(url, json=body, timeout=180)
    if resp.status_code >= 400:
        raise ValueError(f"Gemini image {resp.status_code} ({model}): {resp.text[:400]}")
    payload = resp.json()
    parts = (payload.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
    inline = next((p["inlineData"] for p in parts if isinstance(p, dict) and p.get("inlineData")), None)
    if not inline or not inline.get("data"):
        finish = (payload.get("candidates") or [{}])[0].get("finishReason", "")
        raise ValueError(f"Gemini image returned no image (finishReason={finish or '?'}): "
                         f"{str(payload)[:200]}")
    data = base64.b64decode(inline["data"])
    mime = inline.get("mimeType", "image/png")
    return ImageResult(data, mime, {"provider": "google", "model": model,
                                    "prompt": prompt, "seed": seed})


def _google_generate(prompt: str, aspect_ratio: str, seed: int | None,
                     reference_images: list[dict] | None = None) -> ImageResult:
    """Google image via the API key. Routes by model name: gemini-* → :generateContent
    ("Nano Banana" image models); imagen-* → :predict (legacy Imagen)."""
    import base64

    import httpx

    model = settings.google_image_model
    if model.startswith("gemini"):
        return _google_gemini_generate(prompt, aspect_ratio, seed, model, reference_images)
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


def _vertex_token() -> str:
    """Mint a short-lived OAuth token for Vertex AI (service account or ambient ADC)."""
    import os

    import google.auth
    from google.auth.transport.requests import Request

    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    # google.auth.default() transparently handles BOTH a service-account key and a gcloud ADC
    # (authorized_user) file — so we route any explicit path through GOOGLE_APPLICATION_CREDENTIALS
    # rather than assuming a service-account file.
    if settings.vertex_credentials_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.vertex_credentials_path
    creds, _ = google.auth.default(scopes=scopes)
    creds.refresh(Request())  # mints / refreshes the short-lived access token
    return creds.token


def _vertex_gemini_generate(prompt: str, aspect_ratio: str, seed: int | None,
                            token: str, loc: str, proj: str, model: str,
                            reference_images: list[dict] | None = None) -> ImageResult:
    """Gemini image models ("Nano Banana": gemini-2.5-flash-image / gemini-3-pro-image / …)
    via Vertex AI :generateContent — a different request/response shape than Imagen's :predict."""
    import base64

    import httpx

    url = (
        f"https://{loc}-aiplatform.googleapis.com/v1/projects/{proj}"
        f"/locations/{loc}/publishers/google/models/{model}:generateContent"
    )
    generation_config: dict[str, Any] = {
        "responseModalities": ["IMAGE"],
        "imageConfig": {"aspectRatio": _GOOGLE_ASPECT.get(aspect_ratio, "16:9")},
    }
    if seed is not None:
        generation_config["seed"] = seed
    body = {
        "contents": [{"role": "user", "parts": _gemini_parts(prompt, reference_images)}],
        "generationConfig": generation_config,
    }
    headers = {"Authorization": f"Bearer {token}"}
    if proj:
        headers["x-goog-user-project"] = proj
    resp = httpx.post(url, json=body, headers=headers, timeout=180)
    if resp.status_code >= 400:
        raise ValueError(f"Vertex {resp.status_code} ({model} @ {loc}, proj={proj}): {resp.text[:600]}")
    payload = resp.json()
    parts = (
        (payload.get("candidates") or [{}])[0]
        .get("content", {})
        .get("parts", [])
    )
    inline = next((p["inlineData"] for p in parts if isinstance(p, dict) and p.get("inlineData")), None)
    if not inline or not inline.get("data"):
        finish = (payload.get("candidates") or [{}])[0].get("finishReason", "")
        raise ValueError(f"Vertex Gemini returned no image (finishReason={finish or '?'}): "
                         f"{str(payload)[:200]}")
    data = base64.b64decode(inline["data"])
    mime = inline.get("mimeType", "image/png")
    return ImageResult(data, mime, {"provider": "vertex", "model": model, "prompt": prompt, "seed": seed})


def _vertex_generate(prompt: str, aspect_ratio: str, seed: int | None,
                     reference_images: list[dict] | None = None) -> ImageResult:
    """Google image models via Vertex AI. Routes by model name: gemini-* ("Nano Banana")
    → :generateContent; imagen-* → :predict. Auth is a service-account OAuth token.

    Credentials come from VERTEX_CREDENTIALS_PATH (a service-account .json) or, if that's blank,
    ambient Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS / gcloud auth).
    Reference images condition the Gemini path; Imagen (:predict) ignores them (text-only).
    """
    import base64

    import httpx

    token = _vertex_token()
    loc, proj, model = settings.vertex_location, settings.vertex_project, settings.vertex_image_model
    if model.startswith("gemini"):
        return _vertex_gemini_generate(prompt, aspect_ratio, seed, token, loc, proj, model,
                                       reference_images)
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
    headers = {"Authorization": f"Bearer {token}"}
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


def _fal_generate(prompt: str, w: int, h: int, neg: str, seed: int | None,
                  reference_images: list[dict] | None = None) -> ImageResult:
    import fal_client  # lazy

    import os

    os.environ.setdefault("FAL_KEY", settings.fal_key)
    if reference_images:
        # Reference supplied → image-to-image so the director's reference conditions the result
        # (palette, grade, mood). fal accepts a data-URI for image_url.
        ref = reference_images[0]
        image_url = f"data:{ref.get('mediaType', 'image/jpeg')};base64,{ref['data']}"
        model = settings.fal_image_to_image_model
        args: dict[str, Any] = {
            "prompt": prompt,
            "image_url": image_url,
            "strength": settings.fal_image_strength,
            "image_size": {"width": w, "height": h},
        }
    else:
        model = settings.fal_image_model
        args = {"prompt": prompt, "image_size": {"width": w, "height": h}}
    if seed is not None:
        args["seed"] = seed
    result = fal_client.run(model, arguments=args)
    url = result["images"][0]["url"]
    data, mime = _fetch_bytes(url)
    return ImageResult(data, mime, {"provider": "fal", "model": model, "prompt": prompt,
                                    "seed": seed, "referenced": bool(reference_images)})


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


def _placeholder(prompt: str, w: int, h: int, palette: list[dict],
                 reason: str = "") -> ImageResult:
    """Deterministic cinematic gradient built from the deck palette, used when no image provider
    is available (or one failed).

    Intentionally art-like — a layered gradient with an accent highlight and vignette, and
    crucially NO caption/text — so a fallback never looks like a broken black frame and never
    leaks the internal prompt onto the slide (the old version drew ``prompt[:60]`` into the SVG).
    ``reason`` is recorded in meta (not drawn) so callers/UI/logs can tell why real generation
    was skipped."""
    colors = [c.get("hex") for c in palette if c.get("hex")] or ["#14151C", "#2A1E16", "#B8862F"]
    # Deterministic from the prompt: a given slide is stable across runs, but slides differ.
    h_seed = int(hashlib.sha256((prompt or "").encode("utf-8")).hexdigest(), 16)
    angle = h_seed % 360
    hx = 20 + (h_seed // 7) % 60          # accent-highlight centre x: 20%–80%
    hy = 16 + (h_seed // 1009) % 44       # accent-highlight centre y: 16%–60%
    accent = colors[min(len(colors) - 1, 2)]
    stops = "".join(
        f'<stop offset="{int(i * 100 / max(len(colors) - 1, 1))}%" stop-color="{html.escape(c)}"/>'
        for i, c in enumerate(colors)
    )
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate({angle})">{stops}</linearGradient>
    <radialGradient id="hl" cx="{hx}%" cy="{hy}%" r="70%">
      <stop offset="0%" stop-color="{html.escape(accent)}" stop-opacity="0.42"/>
      <stop offset="55%" stop-color="{html.escape(accent)}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="{html.escape(accent)}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig" cx="50%" cy="50%" r="75%">
      <stop offset="58%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.5"/>
    </radialGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer></filter>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#g)"/>
  <rect width="{w}" height="{h}" fill="url(#hl)"/>
  <rect width="{w}" height="{h}" filter="url(#n)" opacity="0.5"/>
  <rect width="{w}" height="{h}" fill="url(#vig)"/>
</svg>"""
    meta = {"provider": "placeholder", "prompt": prompt}
    if reason:
        meta["reason"] = reason
    return ImageResult(svg.encode("utf-8"), "image/svg+xml", meta)
