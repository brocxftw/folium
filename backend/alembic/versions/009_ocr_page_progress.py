"""Per-page OCR progress on documents.

Revision ID: 009_ocr_page_progress
Revises: 008_library_activity_counters
Create Date: 2026-08-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "009_ocr_page_progress"
down_revision = "008_library_activity_counters"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("ocr_pages_done", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("ocr_pages_total", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "ocr_pages_total")
    op.drop_column("documents", "ocr_pages_done")
