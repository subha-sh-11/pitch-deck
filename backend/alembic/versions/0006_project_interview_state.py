"""Add projects.interview_state — the saved intake/deck-edit conversation (messages, brief,
history), so the chat survives across devices instead of living only in one browser's
localStorage.

Revision ID: 0006_project_interview_state
Revises: 0005_user_password
Create Date: 2026-07-11
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0006_project_interview_state"
down_revision: Union[str, None] = "0005_user_password"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("interview_state", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "interview_state")
