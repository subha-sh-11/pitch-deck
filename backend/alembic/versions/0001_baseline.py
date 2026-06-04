"""baseline schema — frontend-aligned tables + pgvector extension

Revision ID: 0001_baseline
Revises:
Create Date: 2026-05-30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)
JSONB = postgresql.JSONB(astext_type=sa.Text())


def _uuid_pk() -> sa.Column:
    return sa.Column("id", UUID, server_default=sa.text("gen_random_uuid()"), nullable=False)


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    ]


def upgrade() -> None:
    # pgvector deferred to Phase 2 (comps via LLM for now) — see platform alignment doc §9.6.
    # ─── users ───
    op.create_table(
        "users",
        _uuid_pk(),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("role", sa.String(32), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ─── projects ───
    op.create_table(
        "projects",
        _uuid_pk(),
        sa.Column("owner_id", UUID, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("project_type", sa.String(32), nullable=True),
        sa.Column("pitch_purpose", sa.String(32), nullable=True),
        sa.Column("story_stage", sa.String(32), nullable=True),
        sa.Column("genres", JSONB, nullable=True),
        sa.Column("tone", JSONB, nullable=True),
        sa.Column("language", sa.String(64), nullable=True),
        sa.Column("production_status", sa.String(32), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("intake_form", JSONB, nullable=True),
        sa.Column("script_summary", JSONB, nullable=True),
        sa.Column("story_analysis", JSONB, nullable=True),
        sa.Column("last_edited_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_projects"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"],
                                name="fk_projects_owner_id_users", ondelete="CASCADE"),
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])
    op.create_index("ix_projects_status", "projects", ["status"])

    # ─── decks ───
    op.create_table(
        "decks",
        _uuid_pk(),
        sa.Column("project_id", UUID, nullable=False),
        sa.Column("template_id", sa.String(64), nullable=True),
        sa.Column("slide_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("design_direction", JSONB, nullable=True),
        sa.Column("quality_review", JSONB, nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_decks"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"],
                                name="fk_decks_project_id_projects", ondelete="CASCADE"),
    )
    op.create_index("ix_decks_project_id", "decks", ["project_id"])

    # ─── assets ───
    op.create_table(
        "assets",
        _uuid_pk(),
        sa.Column("project_id", UUID, nullable=False),
        sa.Column("slide_id", sa.String(36), nullable=True),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("mime", sa.String(128), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("generation_meta", JSONB, nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_assets"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"],
                                name="fk_assets_project_id_projects", ondelete="CASCADE"),
    )
    op.create_index("ix_assets_project_id", "assets", ["project_id"])

    # ─── slides ───
    op.create_table(
        "slides",
        _uuid_pk(),
        sa.Column("deck_id", UUID, nullable=False),
        sa.Column("slide_number", sa.Integer(), nullable=False),
        sa.Column("slide_type", sa.String(48), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("content", JSONB, nullable=True),
        sa.Column("layout", JSONB, nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("ai_rationale", sa.Text(), nullable=True),
        sa.Column("image_asset_id", UUID, nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_slides"),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"],
                                name="fk_slides_deck_id_decks", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["image_asset_id"], ["assets.id"],
                                name="fk_slides_image_asset_id_assets", ondelete="SET NULL"),
    )
    op.create_index("ix_slides_deck_id", "slides", ["deck_id"])
    op.create_index("ix_slides_image_asset_id", "slides", ["image_asset_id"])

    # ─── generation_jobs ───
    op.create_table(
        "generation_jobs",
        _uuid_pk(),
        sa.Column("project_id", UUID, nullable=False),
        sa.Column("deck_id", UUID, nullable=True),
        sa.Column("slide_id", UUID, nullable=True),
        sa.Column("job_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("params", JSONB, nullable=True),
        sa.Column("result", JSONB, nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_generation_jobs"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"],
                                name="fk_generation_jobs_project_id_projects", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"],
                                name="fk_generation_jobs_deck_id_decks", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["slide_id"], ["slides.id"],
                                name="fk_generation_jobs_slide_id_slides", ondelete="SET NULL"),
    )
    op.create_index("ix_generation_jobs_project_id", "generation_jobs", ["project_id"])
    op.create_index("ix_generation_jobs_deck_id", "generation_jobs", ["deck_id"])
    op.create_index("ix_generation_jobs_slide_id", "generation_jobs", ["slide_id"])
    op.create_index("ix_generation_jobs_status", "generation_jobs", ["status"])


def downgrade() -> None:
    for table in ("generation_jobs", "slides", "assets", "decks", "projects", "users"):
        op.drop_table(table)
