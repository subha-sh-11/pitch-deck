"""Add slides.meta JSONB for editor metadata (notes, transition, appearance, comments).

Revision ID: 0002_slide_meta
Revises: 0001_baseline
Create Date: 2026-06-11
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0002_slide_meta"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("slides", sa.Column("meta", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("slides", "meta")
