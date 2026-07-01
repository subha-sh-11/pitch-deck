"""Add users.password_hash for JWT authentication.

Revision ID: 0005_user_password
Revises: 0004_project_reference_deck
Create Date: 2026-07-01
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_user_password"
down_revision: Union[str, None] = "0004_project_reference_deck"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")
