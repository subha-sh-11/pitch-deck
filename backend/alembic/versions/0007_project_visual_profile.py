"""Add projects.visual_profile — structured reference-derived design profile.

Revision ID: 0007_project_visual_profile
Revises: 0006_project_interview_state
Create Date: 2026-07-15
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0007_project_visual_profile"
down_revision: Union[str, None] = "0006_project_interview_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("visual_profile", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "visual_profile")
