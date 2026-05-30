"""Application configuration, loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    # App
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://pitchdeck:pitchdeck@localhost:5432/pitchdeck"
    database_url_sync: str | None = None

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Object storage
    s3_endpoint: str = "http://localhost:9000"
    s3_bucket: str = "pitchdeck"
    s3_key: str = "minioadmin"
    s3_secret: str = "minioadmin"
    s3_region: str = "us-east-1"

    # AI providers
    anthropic_api_key: str = ""
    fal_key: str = ""
    replicate_api_token: str = ""

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
