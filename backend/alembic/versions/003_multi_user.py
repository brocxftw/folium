"""Multi-user ownership, invites, and quotas.

Revision ID: 003_multi_user
Revises: 002_trash_retention
Create Date: 2026-08-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "003_multi_user"
down_revision = "002_trash_retention"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("storage_quota_bytes", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("ai_monthly_request_quota", sa.Integer(), nullable=True),
    )
    op.alter_column(
        "users",
        "is_admin",
        server_default="false",
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )

    op.create_table(
        "invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("storage_quota_bytes", sa.BigInteger(), nullable=True),
        sa.Column("ai_monthly_request_quota", sa.Integer(), nullable=True),
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
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["used_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_invites_token_hash", "invites", ["token_hash"])
    op.create_index("ix_invites_created_by_id", "invites", ["created_by_id"])

    # --- folders.owner_id ---
    op.add_column(
        "folders",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE folders
        SET owner_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
        WHERE owner_id IS NULL
        """
    )
    op.alter_column("folders", "owner_id", nullable=False)
    op.create_foreign_key(
        "fk_folders_owner_id_users",
        "folders",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_folders_owner_id", "folders", ["owner_id"])
    op.drop_constraint("uq_folder_sibling_name", "folders", type_="unique")
    op.create_unique_constraint(
        "uq_folder_owner_sibling_name",
        "folders",
        ["owner_id", "parent_id", "name"],
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_folders_owner_system_kind
        ON folders (owner_id, kind)
        WHERE kind != 'normal'
        """
    )

    # --- documents.owner_id + shared storage keys ---
    op.add_column(
        "documents",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE documents d
        SET owner_id = f.owner_id
        FROM folders f
        WHERE d.folder_id = f.id AND d.owner_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE documents
        SET owner_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
        WHERE owner_id IS NULL
        """
    )
    op.alter_column("documents", "owner_id", nullable=False)
    op.create_foreign_key(
        "fk_documents_owner_id_users",
        "documents",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_documents_owner_id", "documents", ["owner_id"])
    op.drop_constraint("documents_storage_key_key", "documents", type_="unique")
    op.create_index("ix_documents_storage_key", "documents", ["storage_key"])
    op.create_index(
        "uq_documents_owner_checksum",
        "documents",
        ["owner_id", "checksum"],
        unique=True,
    )

    # --- tags ---
    op.add_column(
        "tags",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE tags
        SET owner_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
        WHERE owner_id IS NULL
        """
    )
    op.alter_column("tags", "owner_id", nullable=False)
    op.create_foreign_key(
        "fk_tags_owner_id_users", "tags", "users", ["owner_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_tags_owner_id", "tags", ["owner_id"])
    op.drop_constraint("tags_name_key", "tags", type_="unique")
    op.drop_constraint("tags_slug_key", "tags", type_="unique")
    op.create_unique_constraint("uq_tags_owner_name", "tags", ["owner_id", "name"])
    op.create_unique_constraint("uq_tags_owner_slug", "tags", ["owner_id", "slug"])

    # --- document_types ---
    op.add_column(
        "document_types",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE document_types
        SET owner_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
        WHERE owner_id IS NULL
        """
    )
    op.alter_column("document_types", "owner_id", nullable=False)
    op.create_foreign_key(
        "fk_document_types_owner_id_users",
        "document_types",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_document_types_owner_id", "document_types", ["owner_id"])
    op.drop_constraint("document_types_name_key", "document_types", type_="unique")
    op.drop_constraint("document_types_slug_key", "document_types", type_="unique")
    op.create_unique_constraint(
        "uq_document_types_owner_name", "document_types", ["owner_id", "name"]
    )
    op.create_unique_constraint(
        "uq_document_types_owner_slug", "document_types", ["owner_id", "slug"]
    )

    # --- correspondents ---
    op.add_column(
        "correspondents",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE correspondents
        SET owner_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
        WHERE owner_id IS NULL
        """
    )
    op.alter_column("correspondents", "owner_id", nullable=False)
    op.create_foreign_key(
        "fk_correspondents_owner_id_users",
        "correspondents",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_correspondents_owner_id", "correspondents", ["owner_id"])
    op.drop_constraint("correspondents_name_key", "correspondents", type_="unique")
    op.drop_constraint("correspondents_slug_key", "correspondents", type_="unique")
    op.create_unique_constraint(
        "uq_correspondents_owner_name", "correspondents", ["owner_id", "name"]
    )
    op.create_unique_constraint(
        "uq_correspondents_owner_slug", "correspondents", ["owner_id", "slug"]
    )

    # --- ai_usage.user_id ---
    op.add_column(
        "ai_usage",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_ai_usage_user_id_users",
        "ai_usage",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_ai_usage_user_id", "ai_usage", ["user_id"])
    op.execute(
        """
        UPDATE ai_usage u
        SET user_id = d.owner_id
        FROM documents d
        WHERE u.document_id = d.id AND u.user_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_ai_usage_user_id_users", "ai_usage", type_="foreignkey")
    op.drop_index("ix_ai_usage_user_id", table_name="ai_usage")
    op.drop_column("ai_usage", "user_id")

    op.drop_constraint("uq_correspondents_owner_slug", "correspondents", type_="unique")
    op.drop_constraint("uq_correspondents_owner_name", "correspondents", type_="unique")
    op.drop_constraint("fk_correspondents_owner_id_users", "correspondents", type_="foreignkey")
    op.drop_index("ix_correspondents_owner_id", table_name="correspondents")
    op.drop_column("correspondents", "owner_id")
    op.create_unique_constraint("correspondents_name_key", "correspondents", ["name"])
    op.create_unique_constraint("correspondents_slug_key", "correspondents", ["slug"])

    op.drop_constraint("uq_document_types_owner_slug", "document_types", type_="unique")
    op.drop_constraint("uq_document_types_owner_name", "document_types", type_="unique")
    op.drop_constraint("fk_document_types_owner_id_users", "document_types", type_="foreignkey")
    op.drop_index("ix_document_types_owner_id", table_name="document_types")
    op.drop_column("document_types", "owner_id")
    op.create_unique_constraint("document_types_name_key", "document_types", ["name"])
    op.create_unique_constraint("document_types_slug_key", "document_types", ["slug"])

    op.drop_constraint("uq_tags_owner_slug", "tags", type_="unique")
    op.drop_constraint("uq_tags_owner_name", "tags", type_="unique")
    op.drop_constraint("fk_tags_owner_id_users", "tags", type_="foreignkey")
    op.drop_index("ix_tags_owner_id", table_name="tags")
    op.drop_column("tags", "owner_id")
    op.create_unique_constraint("tags_name_key", "tags", ["name"])
    op.create_unique_constraint("tags_slug_key", "tags", ["slug"])

    op.drop_index("uq_documents_owner_checksum", table_name="documents")
    op.drop_index("ix_documents_storage_key", table_name="documents")
    op.create_unique_constraint("documents_storage_key_key", "documents", ["storage_key"])
    op.drop_constraint("fk_documents_owner_id_users", "documents", type_="foreignkey")
    op.drop_index("ix_documents_owner_id", table_name="documents")
    op.drop_column("documents", "owner_id")

    op.execute("DROP INDEX IF EXISTS uq_folders_owner_system_kind")
    op.drop_constraint("uq_folder_owner_sibling_name", "folders", type_="unique")
    op.create_unique_constraint("uq_folder_sibling_name", "folders", ["parent_id", "name"])
    op.drop_constraint("fk_folders_owner_id_users", "folders", type_="foreignkey")
    op.drop_index("ix_folders_owner_id", table_name="folders")
    op.drop_column("folders", "owner_id")

    op.drop_index("ix_invites_created_by_id", table_name="invites")
    op.drop_index("ix_invites_token_hash", table_name="invites")
    op.drop_table("invites")

    op.drop_column("users", "ai_monthly_request_quota")
    op.drop_column("users", "storage_quota_bytes")
    op.alter_column(
        "users",
        "is_admin",
        server_default="true",
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )
