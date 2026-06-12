"""Add projects.script_text — full uploaded script kept for the intake conversation.

Revision ID: 0003_project_script_text
Revises: 0002_slide_meta
Create Date: 2026-06-11
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_project_script_text"
down_revision: Union[str, None] = "0002_slide_meta"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("script_text", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "script_text")
