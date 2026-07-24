"""Application configuration, loaded from environment / .env."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchor the .env path to backend/ (two levels up from app/core/) so config loads
# the same file regardless of the process working directory. Real environment
# variables still take precedence over this file (12-factor / production).
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    # App
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"
    # Public base URL the browser uses to reach this backend (for building asset URLs)
    public_base_url: str = "http://localhost:8000"
    # Local directory for generated assets when object storage is unavailable
    local_asset_dir: str = "_assets"

    # Database
    database_url: str = "postgresql+asyncpg://pitchdeck:pitchdeck@localhost:5432/pitchdeck"
    database_url_sync: str | None = None

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Celery
    celery_broker_url: str = ""   # defaults to redis_url if blank
    celery_result_backend: str = ""
    celery_eager: bool = False    # run tasks inline (no worker needed) — handy in dev

    @property
    def broker_url(self) -> str:
        return self.celery_broker_url or self.redis_url

    @property
    def result_backend(self) -> str:
        return self.celery_result_backend or self.redis_url

    @model_validator(mode="after")
    def _auto_public_base_url(self):
        """When PUBLIC_BASE_URL isn't set, fall back to the platform-provided external URL so
        asset links resolve in production. Render injects RENDER_EXTERNAL_URL automatically — this
        avoids images silently pointing at http://localhost:8000 when the env var is forgotten."""
        if self.public_base_url in ("", "http://localhost:8000"):
            ext = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("PUBLIC_BASE_URL")
            if ext:
                self.public_base_url = ext.rstrip("/")
        return self

    # Object storage. Defaults target the local "floci" S3 emulator (docker compose,
    # port 4566, creds test/test). MinIO (port 9000, minioadmin) is an alternative —
    # override S3_ENDPOINT/S3_KEY/S3_SECRET in .env to use it. Any S3/R2 works too.
    s3_endpoint: str = "http://localhost:4566"
    s3_bucket: str = "pitchdeck"
    s3_key: str = "test"
    s3_secret: str = "test"
    s3_region: str = "us-east-1"
    # "auto" (virtual-host, works for AWS/R2) or "path" (Supabase/MinIO/Filebase need this).
    s3_addressing_style: str = "auto"
    # When the bucket is pre-created and the credentials are SCOPED (can't list/create buckets,
    # e.g. Supabase/Filebase/R2 tokens), set true so we skip the list/create probe and just use it.
    s3_bucket_exists: bool = False

    # ─── Resource limits (turn DOWN on small / free-tier hosts) ───
    # Generate slide images during the deck BUILD. Set false on a tiny worker so the build is
    # text-only (fast, low-memory); images are then generated per-slide on demand in the workshop.
    build_with_images: bool = True
    # Condition every deck-build slide image on the director's REFERENCE images (img2img). Default
    # OFF: img2img stamps the same reference onto all slides (they end up looking identical and drag
    # the reference's text/poster structure into every frame). With it off, each slide is generated
    # text-to-image — unique per slide and text-free — while references still drive the DESIGN
    # (palette/typography). Explicit "regenerate with this reference" actions still use img2img.
    build_images_from_references: bool = False
    # Vision-OCR of SCANNED PDFs (renders pages to images — memory heavy). Turn OFF on a 512 MB
    # host; text-based PDFs still parse fine, scanned ones just yield no text (paste instead).
    enable_ocr: bool = True
    # Max PDF pages OCR'd. Rendered a few at a time (streaming), so peak memory is small — but a
    # brief only needs the first pages anyway. Lower on free tier (e.g. 8).
    ocr_max_pages: int = 120
    # Render scale for OCR page images. 2.0 ≈ 144dpi. Drop to 1.0 on a small host — a quarter the
    # pixels/memory, still readable for typed screenplay text.
    ocr_render_scale: float = 2.0

    # ─── LLM (provider-agnostic) ───
    # Which text-LLM backend to use: "auto" picks the first one with a configured key.
    # Supported: auto | anthropic | openai | none
    llm_provider: str = "auto"
    # Optional model override; if blank, each provider's sensible default is used.
    llm_model: str = ""
    llm_max_tokens: int = 2048
    llm_temperature: float = 0.4
    anthropic_api_key: str = ""
    anthropic_default_model: str = "claude-sonnet-4-6"
    openai_api_key: str = ""
    openai_base_url: str = ""  # optional (Azure / OpenAI-compatible gateways)
    openai_default_model: str = "gpt-4o"

    # ─── Image generation (provider-agnostic) ───
    # vertex | fal | replicate | google | auto | none ("none" => palette-driven SVG placeholder).
    # Default "auto" selects the first configured backend (fal → replicate → google → vertex);
    # pin one explicitly in .env (e.g. IMAGE_PROVIDER=fal).
    image_provider: str = "auto"
    fal_key: str = ""
    # flux/dev is far higher fidelity than the speed-optimised flux/schnell (schnell is 4-step and
    # looks visibly "AI"). For the most premium, photoreal results set in .env:
    #   FAL_IMAGE_MODEL=fal-ai/flux-pro/v1.1        (or fal-ai/flux-pro/v1.1-ultra)
    fal_image_model: str = "fal-ai/flux/dev"
    # When reference images are supplied, fal switches to an image-to-image model so the
    # references actually condition the output. ``fal_image_strength`` is FLUX denoise strength —
    # how far the result moves FROM the reference TOWARD the text prompt. Empirically (verified
    # against a text-heavy template reference): ≤0.7 returns a near-copy of the reference —
    # its layout AND garbled text stamped onto every slide (the historical failure mode) — while
    # 0.9 renders the prompt's own scene as a unique, text-free frame that still carries the
    # reference's palette, grade and mood (low reference influence). Keep in the 0.85–0.95 band.
    fal_image_to_image_model: str = "fal-ai/flux/dev/image-to-image"
    fal_image_strength: float = 0.9
    # Hard ceiling on diffusion calls per deck (background + per-element passes combined) so a long
    # deck can't explode image cost / rate-limits. Generous default; lower it to cap spend.
    max_deck_images: int = 48
    replicate_api_token: str = ""
    replicate_image_model: str = "black-forest-labs/flux-schnell"
    google_api_key: str = ""
    # API-key (generativelanguage) path. Gemini image models use :generateContent; Imagen uses
    # :predict — the code routes by name. gemini-2.5-flash-image is the GA "Nano Banana" model.
    google_image_model: str = "gemini-2.5-flash-image"
    # ─── Vertex AI (Google Cloud) — uses a SERVICE ACCOUNT, not an API key ───
    # Set IMAGE_PROVIDER=vertex. Auth via service-account JSON: either VERTEX_CREDENTIALS_PATH
    # or the standard GOOGLE_APPLICATION_CREDENTIALS env var (leave path blank to use that).
    # Image model routes by name: gemini-* ("Nano Banana") → :generateContent; imagen-* → :predict.
    #   Best / recommended: gemini-2.5-flash-image (GA).  Newer preview: gemini-3.1-flash-image.
    #   (Imagen — imagen-4.0-*-generate-001 — is deprecated and shuts down June 2026.)
    vertex_project: str = ""              # GCP project id
    vertex_location: str = "us-central1"  # region the model is served from
    vertex_credentials_path: str = ""     # path to the service-account .json (optional if GOOGLE_APPLICATION_CREDENTIALS set)
    vertex_image_model: str = "gemini-2.5-flash-image"

    # TMDB — real comparable-film posters for the Show Cross slide (free API key)
    tmdb_api_key: str = ""

    # When true, never call external AI providers (deterministic fallbacks only)
    ai_offline: bool = False

    # Auth
    nextauth_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sync_database_url(self) -> str:
        """Sync URL for Alembic. Derived from the async URL if not set explicitly."""
        if self.database_url_sync:
            return self.database_url_sync
        return self.database_url.replace("+asyncpg", "+psycopg2")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
