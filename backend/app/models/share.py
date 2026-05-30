"""Share link, view-event analytics, and async comment models."""
from __future__ import annotations

import datetime
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, uuid_pk


class ShareLink(Base, TimestampMixin):
    __tablename__ = "share_links"

    id: Mapped[uuid.UUID] = uuid_pk()
    variant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_variants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))

    variant: Mapped["DeckVariant"] = relationship(back_populates="share_links")
    view_events: Mapped[list["ViewEvent"]] = relationship(
        back_populates="share_link", cascade="all, delete-orphan"
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="share_link", cascade="all, delete-orphan"
    )


class ViewEvent(Base, TimestampMixin):
    __tablename__ = "view_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    share_link_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("share_links.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slide_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("slides.id", ondelete="SET NULL"), index=True
    )
    viewer_fingerprint: Mapped[str | None] = mapped_column(String(128))
    dwell_ms: Mapped[int | None] = mapped_column(Integer)
    occurred_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))

    share_link: Mapped["ShareLink"] = relationship(back_populates="view_events")


class Comment(Base, TimestampMixin):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = uuid_pk()
    share_link_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("share_links.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slide_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("slides.id", ondelete="SET NULL"), index=True
    )
    author_name: Mapped[str | None] = mapped_column(String(120))
    body: Mapped[str | None] = mapped_column(Text)
    ts_position: Mapped[int | None] = mapped_column(Integer)  # slide index / timeline position

    share_link: Mapped["ShareLink"] = relationship(back_populates="comments")
