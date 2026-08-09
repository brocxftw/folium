"""Settings workspace assignments, telemetry, probes, and logs.

Revision ID: 005_settings_workspace
Revises: 004_avatar_password_reset
Create Date: 2026-08-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "005_settings_workspace"
down_revision = "004_avatar_password_reset"
branch_labels = None
depends_on = None

role_enum = postgresql.ENUM(
    "indexing", "embedding", "chat", "vision", name="ai_workload_role", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    role_enum.create(bind, checkfirst=True)
    op.create_table(
        "ai_model_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("role", role_enum, nullable=False, unique=True),
        sa.Column(
            "provider_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ai_providers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("model", sa.String(256), nullable=True),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    # Preserve current behavior exactly: Chat seeds Indexing and Chat; Embedding
    # keeps its provider/model; Vision remains an explicitly legacy assignment.
    op.execute(
        """
        INSERT INTO ai_model_assignments (id, role, provider_id, model)
        SELECT gen_random_uuid(), seed.role::ai_workload_role, seed.provider_id, seed.model
        FROM (
          SELECT 'indexing' AS role, s.chat_provider_id AS provider_id, p.chat_model AS model
          FROM ai_settings s LEFT JOIN ai_providers p ON p.id = s.chat_provider_id WHERE s.id = 1
          UNION ALL
          SELECT 'chat', s.chat_provider_id, p.chat_model
          FROM ai_settings s LEFT JOIN ai_providers p ON p.id = s.chat_provider_id WHERE s.id = 1
          UNION ALL
          SELECT 'embedding', s.embedding_provider_id, p.embedding_model
          FROM ai_settings s
          LEFT JOIN ai_providers p ON p.id = s.embedding_provider_id
          WHERE s.id = 1
          UNION ALL
          SELECT 'vision', s.vision_provider_id, p.vision_model
          FROM ai_settings s LEFT JOIN ai_providers p ON p.id = s.vision_provider_id WHERE s.id = 1
        ) seed
        ON CONFLICT (role) DO NOTHING
        """
    )

    for name, type_ in (
        ("last_probe_status", sa.String(32)),
        ("last_probe_error", sa.String(512)),
        ("last_probe_latency_ms", sa.Integer()),
        ("last_probe_model_count", sa.Integer()),
        ("last_probed_at", sa.DateTime(timezone=True)),
        ("last_success_at", sa.DateTime(timezone=True)),
    ):
        op.add_column("ai_providers", sa.Column(name, type_, nullable=True))

    op.add_column("ai_usage", sa.Column("duration_ms", sa.Integer(), nullable=True))
    op.add_column(
        "ai_usage",
        sa.Column("status", sa.String(32), nullable=False, server_default="completed"),
    )
    op.add_column("ai_usage", sa.Column("cost_currency", sa.String(8), nullable=True))
    op.add_column("ai_usage", sa.Column("cost_source", sa.String(32), nullable=True))
    op.create_index("ix_ai_usage_created_operation", "ai_usage", ["created_at", "operation"])

    op.create_table(
        "application_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("level", sa.String(16), nullable=False),
        sa.Column("service", sa.String(32), nullable=False),
        sa.Column("module", sa.String(256), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("request_id", sa.String(64), nullable=True),
        sa.Column(
            "context", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")
        ),
        sa.Column("stack_trace", sa.Text(), nullable=True),
    )
    op.create_index("ix_application_logs_timestamp", "application_logs", ["timestamp"])
    op.create_index("ix_application_logs_level_service", "application_logs", ["level", "service"])
    op.create_index("ix_application_logs_request_id", "application_logs", ["request_id"])


def downgrade() -> None:
    op.drop_table("application_logs")
    op.drop_index("ix_ai_usage_created_operation", table_name="ai_usage")
    for name in ("cost_source", "cost_currency", "status", "duration_ms"):
        op.drop_column("ai_usage", name)
    for name in (
        "last_success_at",
        "last_probed_at",
        "last_probe_model_count",
        "last_probe_latency_ms",
        "last_probe_error",
        "last_probe_status",
    ):
        op.drop_column("ai_providers", name)
    op.drop_table("ai_model_assignments")
    role_enum.drop(op.get_bind(), checkfirst=True)
