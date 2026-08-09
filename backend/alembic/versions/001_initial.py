"""Initial Folium schema with pgvector.

Revision ID: 001_initial
Revises:
Create Date: 2026-08-09
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    folder_kind = postgresql.ENUM(
        "root", "inbox", "trash", "normal", name="folder_kind", create_type=False
    )
    processing_status = postgresql.ENUM(
        "pending",
        "processing",
        "ready",
        "failed",
        "partial",
        name="processing_status",
        create_type=False,
    )
    job_status = postgresql.ENUM(
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
        name="job_status",
        create_type=False,
    )
    job_type = postgresql.ENUM(
        "text_extraction",
        "ocr",
        "thumbnail",
        "indexing",
        "embedding",
        "classification",
        "summary",
        "metadata_suggestion",
        name="job_type",
        create_type=False,
    )
    privacy_mode = postgresql.ENUM(
        "local_only",
        "private_hybrid",
        "standard",
        name="privacy_mode",
        create_type=False,
    )
    ai_profile_name = postgresql.ENUM(
        "lightweight",
        "balanced",
        "quality",
        "custom",
        name="ai_profile_name",
        create_type=False,
    )
    provider_kind = postgresql.ENUM(
        "openai_compatible",
        "openai",
        "openrouter",
        "ollama",
        "anthropic",
        "gemini",
        name="provider_kind",
        create_type=False,
    )
    suggestion_status = postgresql.ENUM(
        "pending",
        "accepted",
        "rejected",
        name="suggestion_status",
        create_type=False,
    )

    op.execute(
        "DO $$ BEGIN CREATE TYPE folder_kind AS ENUM "
        "('root','inbox','trash','normal'); EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE processing_status AS ENUM "
        "('pending','processing','ready','failed','partial'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE job_status AS ENUM "
        "('queued','running','completed','failed','cancelled'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE job_type AS ENUM "
        "('text_extraction','ocr','thumbnail','indexing','embedding',"
        "'classification','summary','metadata_suggestion'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE privacy_mode AS ENUM "
        "('local_only','private_hybrid','standard'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE ai_profile_name AS ENUM "
        "('lightweight','balanced','quality','custom'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE provider_kind AS ENUM "
        "('openai_compatible','openai','openrouter','ollama','anthropic','gemini'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE suggestion_status AS ENUM "
        "('pending','accepted','rejected'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(128), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("csrf_token", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
    )
    op.create_index("ix_sessions_token_hash", "sessions", ["token_hash"], unique=True)
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    op.create_table(
        "folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("folders.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("kind", folder_kind, nullable=False, server_default="normal"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("path_cache", sa.String(2048), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("parent_id", "name", name="uq_folder_sibling_name"),
    )
    op.create_index("ix_folders_parent_id", "folders", ["parent_id"])

    op.create_table(
        "tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("color", sa.String(16), nullable=False, server_default="#64748b"),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "document_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "correspondents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("original_filename", sa.String(512), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("language", sa.String(16), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("archive_serial", sa.String(64), nullable=True),
        sa.Column("folder_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("folders.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("document_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("document_types.id", ondelete="SET NULL"), nullable=True),
        sa.Column("correspondent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("correspondents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_date", sa.Date(), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("added_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("modified_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processing_status", processing_status, nullable=False, server_default="pending"),
        sa.Column("ocr_completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("text_extracted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("document_indexed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("has_embeddings", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_trashed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("trashed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("inbox", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("needs_review", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("custom_fields", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("ai_summary_meta", postgresql.JSONB(), nullable=True),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("thumbnail_key", sa.String(512), nullable=True),
        sa.Column("preview_key", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("storage_key"),
        sa.UniqueConstraint("archive_serial"),
    )
    op.create_index("ix_documents_folder_id", "documents", ["folder_id"])
    op.create_index("ix_documents_checksum", "documents", ["checksum"])
    op.create_index("ix_documents_title", "documents", ["title"])
    op.create_index("ix_documents_search_vector", "documents", ["search_vector"], postgresql_using="gin")

    op.create_table(
        "document_tags",
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "document_pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
        sa.UniqueConstraint("document_id", "page_number", name="uq_document_page"),
    )
    op.create_index("ix_document_pages_document_id", "document_pages", ["document_id"])
    op.create_index("ix_document_pages_search_vector", "document_pages", ["search_vector"], postgresql_using="gin")

    op.create_table(
        "document_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("section", sa.String(512), nullable=True),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("embedding_provider", sa.String(64), nullable=True),
        sa.Column("embedding_model", sa.String(128), nullable=True),
        sa.Column("embedding_dimension", sa.Integer(), nullable=True),
        sa.Column("embedding", Vector(3072), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index(
        "ix_document_chunks_embedding_space",
        "document_chunks",
        ["embedding_provider", "embedding_model"],
    )

    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_type", job_type, nullable=False),
        sa.Column("status", job_status, nullable=False, server_default="queued"),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("result", postgresql.JSONB(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_by", sa.String(128), nullable=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_jobs_status_priority", "jobs", ["status", "priority", "created_at"])
    op.create_index("ix_jobs_document_id", "jobs", ["document_id"])

    op.create_table(
        "ai_providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("kind", provider_kind, nullable=False),
        sa.Column("base_url", sa.String(512), nullable=False),
        sa.Column("encrypted_api_key", sa.LargeBinary(), nullable=True),
        sa.Column("is_local", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("chat_model", sa.String(256), nullable=True),
        sa.Column("embedding_model", sa.String(256), nullable=True),
        sa.Column("vision_model", sa.String(256), nullable=True),
        sa.Column("context_window", sa.Integer(), nullable=True),
        sa.Column("max_output_tokens", sa.Integer(), nullable=True),
        sa.Column("supports_tools", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("supports_vision", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("supports_structured_output", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("supports_embeddings", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("no_training", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("zero_retention", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("extra", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "ai_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("privacy_mode", privacy_mode, nullable=False, server_default="local_only"),
        sa.Column("profile", ai_profile_name, nullable=False, server_default="lightweight"),
        sa.Column("chat_provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_providers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("embedding_provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_providers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("vision_provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_providers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("allow_remote_embeddings", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("allow_remote_qa", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("allow_remote_vision", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("warn_before_remote", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("block_remote_ai", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("auto_enrichment", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("auto_tagging", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("retrieved_chunks", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("max_context_tokens", sa.Integer(), nullable=False, server_default="8000"),
        sa.Column("max_output_tokens", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("conversation_history_tokens", sa.Integer(), nullable=False, server_default="2000"),
        sa.Column("parallel_llm_calls", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("active_embedding_provider", sa.String(64), nullable=True),
        sa.Column("active_embedding_model", sa.String(128), nullable=True),
        sa.Column("active_embedding_dimension", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "ai_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider", sa.String(64), nullable=False),
        sa.Column("model", sa.String(128), nullable=False),
        sa.Column("operation", sa.String(64), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("reported_cost", sa.Float(), nullable=True),
        sa.Column("estimated_cost", sa.Float(), nullable=True),
        sa.Column("is_local", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_usage_created_at", "ai_usage", ["created_at"])

    op.create_table(
        "ai_suggestions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field", sa.String(64), nullable=False),
        sa.Column("value", postgresql.JSONB(), nullable=False),
        sa.Column("status", suggestion_status, nullable=False, server_default="pending"),
        sa.Column("provider", sa.String(64), nullable=True),
        sa.Column("model", sa.String(128), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_suggestions_document_id", "ai_suggestions", ["document_id"])

    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(128), primary_key=True),
        sa.Column("value", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    for table in [
        "app_settings",
        "ai_suggestions",
        "ai_usage",
        "ai_settings",
        "ai_providers",
        "jobs",
        "document_chunks",
        "document_pages",
        "document_tags",
        "documents",
        "correspondents",
        "document_types",
        "tags",
        "folders",
        "sessions",
        "users",
    ]:
        op.drop_table(table)

    for enum_name in [
        "suggestion_status",
        "provider_kind",
        "ai_profile_name",
        "privacy_mode",
        "job_type",
        "job_status",
        "processing_status",
        "folder_kind",
    ]:
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
