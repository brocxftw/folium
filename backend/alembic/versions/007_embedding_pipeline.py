"""Additive embedding pipeline progress and capability fields.

Revision ID: 007_embedding_pipeline
Revises: 006_job_available_at
Create Date: 2026-08-10
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "007_embedding_pipeline"
down_revision = "006_job_available_at"
branch_labels = None
depends_on = None

_chunk_embedding_status = postgresql.ENUM(
    "pending",
    "embedding",
    "embedded",
    "failed",
    name="chunk_embedding_status",
    create_type=False,
)


def upgrade() -> None:
    _chunk_embedding_status.create(op.get_bind(), checkfirst=True)

    op.add_column("documents", sa.Column("chunks_total", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("chunks_embedded", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("chunks_failed", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("embedding_error", sa.Text(), nullable=True))
    op.add_column(
        "documents",
        sa.Column("embedding_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("embedding_finished_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column("document_chunks", sa.Column("page_end", sa.Integer(), nullable=True))
    op.add_column("document_chunks", sa.Column("content_hash", sa.String(length=64), nullable=True))
    op.add_column(
        "document_chunks",
        sa.Column("chunking_version", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "document_chunks",
        sa.Column(
            "embedding_status",
            _chunk_embedding_status,
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column("document_chunks", sa.Column("embedding_error", sa.Text(), nullable=True))
    op.add_column(
        "document_chunks",
        sa.Column("embedding_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_document_chunks_document_status",
        "document_chunks",
        ["document_id", "embedding_status"],
    )

    op.execute(
        """
        UPDATE document_chunks
        SET page_end = page_number
        WHERE page_number IS NOT NULL AND page_end IS NULL
        """
    )
    op.execute(
        """
        UPDATE document_chunks
        SET embedding_status = 'embedded'
        WHERE embedding IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE documents d
        SET chunks_total = sub.total,
            chunks_embedded = sub.embedded,
            chunks_failed = 0
        FROM (
            SELECT document_id,
                   COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedded
            FROM document_chunks
            GROUP BY document_id
        ) AS sub
        WHERE d.id = sub.document_id
        """
    )

    op.add_column(
        "ai_providers",
        sa.Column("embedding_max_input_tokens", sa.Integer(), nullable=True),
    )
    op.add_column(
        "ai_providers",
        sa.Column("embedding_recommended_chunk_tokens", sa.Integer(), nullable=True),
    )
    op.add_column(
        "ai_providers",
        sa.Column("embedding_batch_size", sa.Integer(), nullable=True),
    )
    op.add_column(
        "ai_providers",
        sa.Column("embedding_max_batch_size", sa.Integer(), nullable=True),
    )
    op.add_column(
        "ai_providers",
        sa.Column("embedding_concurrency", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_providers", "embedding_concurrency")
    op.drop_column("ai_providers", "embedding_max_batch_size")
    op.drop_column("ai_providers", "embedding_batch_size")
    op.drop_column("ai_providers", "embedding_recommended_chunk_tokens")
    op.drop_column("ai_providers", "embedding_max_input_tokens")

    op.drop_index("ix_document_chunks_document_status", table_name="document_chunks")
    op.drop_column("document_chunks", "embedding_attempts")
    op.drop_column("document_chunks", "embedding_error")
    op.drop_column("document_chunks", "embedding_status")
    op.drop_column("document_chunks", "chunking_version")
    op.drop_column("document_chunks", "content_hash")
    op.drop_column("document_chunks", "page_end")

    op.drop_column("documents", "embedding_finished_at")
    op.drop_column("documents", "embedding_started_at")
    op.drop_column("documents", "embedding_error")
    op.drop_column("documents", "chunks_failed")
    op.drop_column("documents", "chunks_embedded")
    op.drop_column("documents", "chunks_total")

    op.execute("DROP TYPE IF EXISTS chunk_embedding_status")
