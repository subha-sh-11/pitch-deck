"""baseline schema — 13 core tables + pgvector extension

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
    return sa.Column(
        "id", UUID, server_default=sa.text("gen_random_uuid()"), nullable=False
    )


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    ]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

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
        sa.Column("master_project_id", UUID, nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("format", sa.String(32), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("style_register", sa.String(48), nullable=True),
        sa.Column("starting_point", sa.String(32), nullable=True),
        sa.Column("project_type", sa.String(32), nullable=True),
        sa.Column("pitch_purpose", sa.String(32), nullable=True),
        sa.Column("story_stage", sa.String(32), nullable=True),
        sa.Column("language", sa.String(48), nullable=True),
        sa.Column("genre", JSONB, nullable=True),
        sa.Column("tone", sa.String(64), nullable=True),
        sa.Column("production_status", sa.String(32), nullable=True),
        sa.Column("source_material", JSONB, nullable=True),
        sa.Column("last_edited_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_projects"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"],
                                name="fk_projects_owner_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["master_project_id"], ["projects.id"],
                                name="fk_projects_master_project_id_projects", ondelete="SET NULL"),
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])
    op.create_index("ix_projects_master_project_id", "projects", ["master_project_id"])
    op.create_index("ix_projects_status", "projects", ["status"])

    # ─── vision_documents ───
    op.create_table(
        "vision_documents",
        _uuid_pk(),
        sa.Column("project_id", UUID, nullable=False),
        sa.Column("user_state", sa.String(32), nullable=True),
        sa.Column("vision", JSONB, nullable=True),
        sa.Column("confirmed", sa.Boolean(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_vision_documents"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"],
                                name="fk_vision_documents_project_id_projects", ondelete="CASCADE"),
    )
    op.create_index("ix_vision_documents_project_id", "vision_documents",
                    ["project_id"], unique=True)

    # ─── intake_sessions ───
    op.create_table(
        "intake_sessions",
        _uuid_pk(),
        sa.Column("project_id", UUID, nullable=False),
        sa.Column("transcript", JSONB, nullable=True),
        sa.Column("detected_state", sa.String(32), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_intake_sessions"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"],
                                name="fk_intake_sessions_project_id_projects", ondelete="CASCADE"),
    )
    op.create_index("ix_intake_sessions_project_id", "intake_sessions", ["project_id"])

    # ─── deck_variants ───
    op.create_table(
        "deck_variants",
        _uuid_pk(),
        sa.Column("project_id", UUID, nullable=False),
        sa.Column("label", sa.String(120), nullable=True),
        sa.Column("slide_count", sa.Integer(), nullable=False),
        sa.Column("outline", JSONB, nullable=True),
        sa.Column("design_direction", JSONB, nullable=True),
        sa.Column("layout_meta", JSONB, nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_deck_variants"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"],
                                name="fk_deck_variants_project_id_projects", ondelete="CASCADE"),
    )
    op.create_index("ix_deck_variants_project_id", "deck_variants", ["project_id"])

    # ─── slides ───
    op.create_table(
        "slides",
        _uuid_pk(),
        sa.Column("variant_id", UUID, nullable=False),
        sa.Column("slide_type", sa.String(48), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("content", JSONB, nullable=True),
        sa.Column("layout", JSONB, nullable=True),
        sa.Column("is_locked", sa.Boolean(), nullable=False),
        sa.Column("ai_generated", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_slides"),
        sa.ForeignKeyConstraint(["variant_id"], ["deck_variants.id"],
                                name="fk_slides_variant_id_deck_variants", ondelete="CASCADE"),
    )
    op.create_index("ix_slides_variant_id", "slides", ["variant_id"])

    # ─── assets ───
    op.create_table(
        "assets",
        _uuid_pk(),
        sa.Column("project_id", UUID, nullable=False),
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

    # ─── generation_jobs ───
    op.create_table(
        "generation_jobs",
        _uuid_pk(),
        sa.Column("project_id", UUID, nullable=False),
        sa.Column("slide_id", UUID, nullable=True),
        sa.Column("job_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("params", JSONB, nullable=True),
        sa.Column("result", JSONB, nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_generation_jobs"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"],
                                name="fk_generation_jobs_project_id_projects", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["slide_id"], ["slides.id"],
                                name="fk_generation_jobs_slide_id_slides", ondelete="SET NULL"),
    )
    op.create_index("ix_generation_jobs_project_id", "generation_jobs", ["project_id"])
    op.create_index("ix_generation_jobs_slide_id", "generation_jobs", ["slide_id"])
    op.create_index("ix_generation_jobs_status", "generation_jobs", ["status"])

    # ─── review_findings ───
    op.create_table(
        "review_findings",
        _uuid_pk(),
        sa.Column("variant_id", UUID, nullable=False),
        sa.Column("slide_id", UUID, nullable=True),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("severity", sa.String(16), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("suggested_fix", JSONB, nullable=True),
        sa.Column("resolution", sa.String(16), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_review_findings"),
        sa.ForeignKeyConstraint(["variant_id"], ["deck_variants.id"],
                                name="fk_review_findings_variant_id_deck_variants", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["slide_id"], ["slides.id"],
                                name="fk_review_findings_slide_id_slides", ondelete="SET NULL"),
    )
    op.create_index("ix_review_findings_variant_id", "review_findings", ["variant_id"])
    op.create_index("ix_review_findings_slide_id", "review_findings", ["slide_id"])

    # ─── deck_versions ───
    op.create_table(
        "deck_versions",
        _uuid_pk(),
        sa.Column("variant_id", UUID, nullable=False),
        sa.Column("snapshot", JSONB, nullable=True),
        sa.Column("label", sa.String(120), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_deck_versions"),
        sa.ForeignKeyConstraint(["variant_id"], ["deck_variants.id"],
                                name="fk_deck_versions_variant_id_deck_variants", ondelete="CASCADE"),
    )
    op.create_index("ix_deck_versions_variant_id", "deck_versions", ["variant_id"])

    # ─── share_links ───
    op.create_table(
        "share_links",
        _uuid_pk(),
        sa.Column("variant_id", UUID, nullable=False),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_share_links"),
        sa.ForeignKeyConstraint(["variant_id"], ["deck_variants.id"],
                                name="fk_share_links_variant_id_deck_variants", ondelete="CASCADE"),
    )
    op.create_index("ix_share_links_variant_id", "share_links", ["variant_id"])
    op.create_index("ix_share_links_token", "share_links", ["token"], unique=True)

    # ─── view_events ───
    op.create_table(
        "view_events",
        _uuid_pk(),
        sa.Column("share_link_id", UUID, nullable=False),
        sa.Column("slide_id", UUID, nullable=True),
        sa.Column("viewer_fingerprint", sa.String(128), nullable=True),
        sa.Column("dwell_ms", sa.Integer(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_view_events"),
        sa.ForeignKeyConstraint(["share_link_id"], ["share_links.id"],
                                name="fk_view_events_share_link_id_share_links", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["slide_id"], ["slides.id"],
                                name="fk_view_events_slide_id_slides", ondelete="SET NULL"),
    )
    op.create_index("ix_view_events_share_link_id", "view_events", ["share_link_id"])
    op.create_index("ix_view_events_slide_id", "view_events", ["slide_id"])

    # ─── comments ───
    op.create_table(
        "comments",
        _uuid_pk(),
        sa.Column("share_link_id", UUID, nullable=False),
        sa.Column("slide_id", UUID, nullable=True),
        sa.Column("author_name", sa.String(120), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("ts_position", sa.Integer(), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_comments"),
        sa.ForeignKeyConstraint(["share_link_id"], ["share_links.id"],
                                name="fk_comments_share_link_id_share_links", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["slide_id"], ["slides.id"],
                                name="fk_comments_slide_id_slides", ondelete="SET NULL"),
    )
    op.create_index("ix_comments_share_link_id", "comments", ["share_link_id"])
    op.create_index("ix_comments_slide_id", "comments", ["slide_id"])


def downgrade() -> None:
    for table in (
        "comments", "view_events", "share_links", "deck_versions", "review_findings",
        "generation_jobs", "assets", "slides", "deck_variants", "intake_sessions",
        "vision_documents", "projects", "users",
    ):
        op.drop_table(table)
