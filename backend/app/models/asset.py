"""Asset (every image/upload/export) and async generation-job models."""
from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class Asset(Base, TimestampMixin):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # upload_ref | title_bg | character_art | mood_image | comp_poster | export_pdf | export_pptx
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)  # S3 object key
    mime: Mapped[str | None] = mapped_column(String(128))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    # prompt, model, seed, register, parent_asset_id, mode, strength, aspect_ratio, ...
    generation_meta: Mapped[dict | None] = mapped_column(JSONB)

    project: Mapped["Project"] = relationship(back_populates="assets")


class GenerationJob(Base, TimestampMixin):
    __tablename__ = "generation_jobs"

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slide_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("slides.id", ondelete="SET NULL"), index=True
    )
    # image | image2image | variation | text | review | export
    job_type: Mapped[str] = mapped_column(String(32), nullable=False)
    # queued | running | succeeded | failed
    status: Mapped[str] = mapped_column(String(16), default="queued", nullable=False, index=True)
    params: Mapped[dict | None] = mapped_column(JSONB)
    result: Mapped[dict | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    finished_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
