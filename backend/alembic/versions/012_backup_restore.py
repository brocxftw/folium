"""Backup and restore tables, job types, instance state seed.

Revision ID: 012_backup_restore
Revises: 011_ask_conversations
Create Date: 2026-08-17
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "012_backup_restore"
down_revision = "011_ask_conversations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'backup'")
    op.execute("ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'backup_verify'")

    backup_schedule_type = postgresql.ENUM(
        "daily",
        "weekly",
        "interval_hours",
        name="backup_schedule_type",
        create_type=False,
    )
    backup_record_status = postgresql.ENUM(
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
        name="backup_record_status",
        create_type=False,
    )
    backup_verification_status = postgresql.ENUM(
        "healthy",
        "unverified",
        "corrupted",
        "incompatible",
        "failed",
        name="backup_verification_status",
        create_type=False,
    )

    backup_schedule_type.create(op.get_bind(), checkfirst=True)
    backup_record_status.create(op.get_bind(), checkfirst=True)
    backup_verification_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "backup_settings",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "schedule_type",
            backup_schedule_type,
            server_default="daily",
            nullable=False,
        ),
        sa.Column("backup_time", sa.String(5), server_default="02:00", nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=True),
        sa.Column("interval_hours", sa.Integer(), nullable=True),
        sa.Column("repository_subdir", sa.String(256), server_default="", nullable=False),
        sa.Column("retention_count", sa.Integer(), server_default="7", nullable=False),
        sa.Column("verify_after_backup", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
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
    op.execute("INSERT INTO backup_settings (id) VALUES (1)")

    op.create_table(
        "backup_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("relative_key", sa.String(512), nullable=False),
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
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("document_count", sa.Integer(), nullable=True),
        sa.Column("folium_version", sa.String(64), nullable=True),
        sa.Column("schema_version", sa.String(64), nullable=True),
        sa.Column("format_version", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            backup_record_status,
            server_default="queued",
            nullable=False,
        ),
        sa.Column(
            "verification_status",
            backup_verification_status,
            server_default="unverified",
            nullable=False,
        ),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("manifest", postgresql.JSONB(), nullable=True),
        sa.Column("progress_stage", sa.String(64), nullable=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_backup_records_created_at", "backup_records", ["created_at"])

    # Seed instance_state based on whether users exist.
    conn = op.get_bind()
    has_users = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM users LIMIT 1)")).scalar()
    state = "ready" if has_users else "uninitialised"
    import json

    op.execute(
        sa.text(
            "INSERT INTO app_settings (key, value, created_at, updated_at) "
            "VALUES ('instance_state', CAST(:val AS jsonb), now(), now()) "
            "ON CONFLICT (key) DO NOTHING"
        ).bindparams(val=json.dumps({"state": state}))
    )


def downgrade() -> None:
    op.drop_index("ix_backup_records_created_at", table_name="backup_records")
    op.drop_table("backup_records")
    op.drop_table("backup_settings")
    op.execute("DELETE FROM app_settings WHERE key = 'instance_state'")
    op.execute("DROP TYPE IF EXISTS backup_verification_status")
    op.execute("DROP TYPE IF EXISTS backup_record_status")
    op.execute("DROP TYPE IF EXISTS backup_schedule_type")
    # PostgreSQL does not support removing enum values; job_type backup values remain.
