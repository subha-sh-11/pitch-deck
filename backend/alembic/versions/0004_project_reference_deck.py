"""Add projects.reference_deck — parsed reference deck (.pptx) used to mirror style + structure.

Revision ID: 0004_project_reference_deck
Revises: 0003_project_script_text
Create Date: 2026-06-18
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0004_project_reference_deck"
down_revision: Union[str, None] = "0003_project_script_text"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("reference_deck", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "reference_deck")
