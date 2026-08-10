"""Add delayed retry scheduling for background jobs.

Revision ID: 006_job_available_at
Revises: 005_settings_workspace
Create Date: 2026-08-10
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "006_job_available_at"
down_revision = "005_settings_workspace"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_jobs_available_at", "jobs", ["available_at"])


def downgrade() -> None:
    op.drop_index("ix_jobs_available_at", table_name="jobs")
    op.drop_column("jobs", "available_at")
