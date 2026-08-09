"""User avatars and admin-approved password reset requests.

Revision ID: 004_avatar_password_reset
Revises: 003_multi_user
Create Date: 2026-08-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "004_avatar_password_reset"
down_revision = "003_multi_user"
branch_labels = None
depends_on = None

password_reset_status = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    "used",
    "expired",
    name="password_reset_status",
    create_type=False,
)


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_key", sa.String(512), nullable=True))

    bind = op.get_bind()
    password_reset_status.create(bind, checkfirst=True)

    op.create_table(
        "password_reset_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "status",
            password_reset_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reset_token_hash", sa.String(128), nullable=True, unique=True),
        sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "approved_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_password_reset_requests_status",
        "password_reset_requests",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_password_reset_requests_status", table_name="password_reset_requests")
    op.drop_table("password_reset_requests")
    password_reset_status.drop(op.get_bind(), checkfirst=True)
    op.drop_column("users", "avatar_key")
