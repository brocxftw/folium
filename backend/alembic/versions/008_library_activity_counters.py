"""Owner-scoped increment-only library activity counters.

Revision ID: 008_library_activity_counters
Revises: 007_embedding_pipeline
Create Date: 2026-08-11
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "008_library_activity_counters"
down_revision = "007_embedding_pipeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "library_activity_counters",
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("documents_ingested", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("bytes_ingested", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("pages_processed", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("successful_processing", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("ocr_pages", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("failed_documents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("duplicates_rejected", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("purged_documents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column(
            "reset_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("library_activity_counters")
