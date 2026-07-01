"""Application configuration, loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

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
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
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

    # Object storage
    s3_endpoint: str = "http://localhost:9000"
    s3_bucket: str = "pitchdeck"
    s3_key: str = "minioadmin"
    s3_secret: str = "minioadmin"
    s3_region: str = "us-east-1"

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
    # auto | fal | replicate | google | vertex | none ("none" => palette-driven SVG placeholder)
    image_provider: str = "auto"
    fal_key: str = ""
    fal_image_model: str = "fal-ai/flux/schnell"
    # Image-to-image model (style/structure transfer from a reference image).
    fal_i2i_model: str = "fal-ai/flux/dev/image-to-image"
    replicate_api_token: str = ""
    replicate_image_model: str = "black-forest-labs/flux-schnell"
    google_api_key: str = ""
    # imagen-4.0-fast-generate-001 (fast) | imagen-4.0-generate-001 | imagen-4.0-ultra-generate-001
    google_image_model: str = "imagen-4.0-fast-generate-001"
    # ─── Vertex AI (Google Cloud) Imagen — uses a SERVICE ACCOUNT, not an API key ───
    # Set IMAGE_PROVIDER=vertex. Auth via service-account JSON: either VERTEX_CREDENTIALS_PATH
    # or the standard GOOGLE_APPLICATION_CREDENTIALS env var (leave path blank to use that).
    vertex_project: str = ""              # GCP project id
    vertex_location: str = "us-central1"  # region the model is served from
    vertex_credentials_path: str = ""     # path to the service-account .json (optional if GOOGLE_APPLICATION_CREDENTIALS set)
    vertex_image_model: str = "imagen-3.0-generate-002"

    # TMDB — real comparable-film posters for the Show Cross slide (free API key)
    tmdb_api_key: str = ""

    # When true, never call external AI providers (deterministic fallbacks only)
    ai_offline: bool = False

    # Auth
    nextauth_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"

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
