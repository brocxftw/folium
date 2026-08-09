"""Add soft-delete fields for folders and restore hints for documents.

Revision ID: 002_trash_retention
Revises: 001_initial
Create Date: 2026-08-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "002_trash_retention"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "folders",
        sa.Column("is_trashed", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "folders",
        sa.Column("trashed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_folders_is_trashed", "folders", ["is_trashed"])

    op.add_column(
        "documents",
        sa.Column(
            "trashed_from_folder_id",
            sa.UUID(),
            sa.ForeignKey("folders.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("documents", "trashed_from_folder_id")
    op.drop_index("ix_folders_is_trashed", table_name="folders")
    op.drop_column("folders", "trashed_at")
    op.drop_column("folders", "is_trashed")
