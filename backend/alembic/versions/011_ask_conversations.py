"""One active Ask conversation per owner+document.

Revision ID: 011_ask_conversations
Revises: 010_semantic_min_score
Create Date: 2026-08-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "011_ask_conversations"
down_revision = "010_semantic_min_score"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ask_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "owner_id",
            "document_id",
            name="uq_ask_conversations_owner_document",
        ),
    )
    op.create_index("ix_ask_conversations_owner_id", "ask_conversations", ["owner_id"])
    op.create_index("ix_ask_conversations_document_id", "ask_conversations", ["document_id"])

    op.create_table(
        "ask_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("citations", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["ask_conversations.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_ask_messages_conversation_id", "ask_messages", ["conversation_id"])
    op.create_index("ix_ask_messages_created_at", "ask_messages", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_ask_messages_created_at", table_name="ask_messages")
    op.drop_index("ix_ask_messages_conversation_id", table_name="ask_messages")
    op.drop_table("ask_messages")
    op.drop_index("ix_ask_conversations_document_id", table_name="ask_conversations")
    op.drop_index("ix_ask_conversations_owner_id", table_name="ask_conversations")
    op.drop_table("ask_conversations")
