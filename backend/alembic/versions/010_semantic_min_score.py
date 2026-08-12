"""Optional semantic similarity floor for Ask/RAG.

Revision ID: 010_semantic_min_score
Revises: 009_ocr_page_progress
Create Date: 2026-08-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "010_semantic_min_score"
down_revision = "009_ocr_page_progress"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_settings",
        sa.Column("semantic_min_score", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_settings", "semantic_min_score")
