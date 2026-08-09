"""Document ingestion and metadata services."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from folium.core.exceptions import DuplicateDocumentError, NotFoundError, ValidationError
from folium.core.files import (
    assert_allowed_mime,
    detect_mime,
    extension_for_mime,
    normalize_filename,
    split_relative_path,
)
from folium.models import (
    Correspondent,
    Document,
    DocumentType,
    Folder,
    FolderKind,
    JobType,
    ProcessingStatus,
    Tag,
)
from folium.services import folders as folder_service
from folium.services.jobs import enqueue_job
from folium.services.quotas import assert_storage_quota
from folium.storage.service import StorageService


@dataclass(slots=True)
class IngestResult:
    status: Literal["created", "duplicate"]
    document: Document | None = None
    existing_document_id: str | None = None
    relative_path: str | None = None


async def find_by_checksum(
    session: AsyncSession, checksum: str, owner_id: uuid.UUID
) -> Document | None:
    return (
        await session.execute(
            select(Document)
            .where(
                Document.owner_id == owner_id,
                Document.checksum == checksum,
                Document.is_trashed.is_(False),
            )
            .limit(1)
        )
    ).scalar_one_or_none()


def _document_options() -> tuple:
    return (
        selectinload(Document.tags),
        selectinload(Document.document_type),
        selectinload(Document.correspondent),
        selectinload(Document.folder),
    )


async def get_document(
    session: AsyncSession,
    document_id: uuid.UUID,
    *,
    owner_id: uuid.UUID | None = None,
) -> Document:
    result = await session.execute(
        select(Document).options(*_document_options()).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if doc is None or (owner_id is not None and doc.owner_id != owner_id):
        raise NotFoundError("Document not found")
    return doc


async def ingest_bytes(
    session: AsyncSession,
    *,
    owner_id: uuid.UUID,
    data: bytes,
    filename: str,
    folder_id: uuid.UUID | None = None,
    relative_path: str | None = None,
    on_duplicate: Literal["error", "skip"] = "error",
    storage: StorageService | None = None,
    priority: int = 50,
) -> IngestResult:
    """Ingest file bytes into content-addressed storage.

    Duplicate policy (SHA-256 of file contents):
    - ``error`` (default): raise ``DuplicateDocumentError`` (HTTP 409)
    - ``skip``: return ``status=duplicate`` without creating a second document

    Physical storage remains content-addressed — one blob per checksum.
    Logical Folium folders are metadata only; ``relative_path`` recreates a
    folder tree under ``folder_id`` (or Documents root when a tree path is
    provided without an explicit parent).
    """
    storage = storage or StorageService()
    rel = relative_path.strip() if relative_path else None
    if rel:
        segments, filename = split_relative_path(rel)
    else:
        segments = []
        filename = normalize_filename(filename)

    if not data:
        raise ValidationError("Empty file")
    from folium.core.config import get_settings

    if len(data) > get_settings().max_upload_bytes:
        raise ValidationError("File exceeds upload size limit")

    mime = detect_mime(data, filename)
    assert_allowed_mime(mime)
    checksum = storage.sha256_bytes(data)

    existing = await find_by_checksum(session, checksum, owner_id)
    if existing is not None:
        if on_duplicate == "skip":
            return IngestResult(
                status="duplicate",
                existing_document_id=str(existing.id),
                relative_path=rel,
            )
        raise DuplicateDocumentError(
            "Document already exists",
            existing_document_id=str(existing.id),
        )

    await assert_storage_quota(session, owner_id, len(data))

    if segments:
        # Tree imports nest under the given parent, or Documents root (not Inbox).
        if folder_id is None:
            parent = await folder_service.get_root(session, owner_id)
            parent_id = parent.id
        else:
            await folder_service.get_folder(session, folder_id, owner_id=owner_id)
            parent_id = folder_id
        leaf = await folder_service.ensure_folder_path(
            session, parent_id=parent_id, segments=segments
        )
        folder_id = leaf.id
        inbox_flag = leaf.kind == FolderKind.INBOX
    elif folder_id is None:
        inbox = await folder_service.get_inbox(session, owner_id)
        folder_id = inbox.id
        inbox_flag = True
    else:
        folder = await folder_service.get_folder(session, folder_id, owner_id=owner_id)
        inbox_flag = folder.kind == FolderKind.INBOX

    ext = extension_for_mime(mime, filename)
    storage_key = await storage.persist_original(data, checksum=checksum, extension=ext)
    title = Path(filename).stem or filename

    doc = Document(
        owner_id=owner_id,
        title=title,
        original_filename=filename,
        storage_key=storage_key,
        checksum=checksum,
        mime_type=mime,
        file_size=len(data),
        folder_id=folder_id,
        processing_status=ProcessingStatus.PENDING,
        inbox=inbox_flag,
        custom_fields={},
    )
    session.add(doc)
    await session.flush()

    await enqueue_job(
        session,
        job_type=JobType.TEXT_EXTRACTION,
        document_id=doc.id,
        priority=priority,
    )
    await enqueue_job(
        session,
        job_type=JobType.THUMBNAIL,
        document_id=doc.id,
        priority=priority + 10,
    )
    created = await get_document(session, doc.id, owner_id=owner_id)
    return IngestResult(status="created", document=created, relative_path=rel)


async def ingest_path(
    session: AsyncSession,
    path: Path,
    *,
    owner_id: uuid.UUID,
    storage: StorageService | None = None,
    priority: int = 80,
    folder_id: uuid.UUID | None = None,
    relative_path: str | None = None,
    on_duplicate: Literal["error", "skip"] = "error",
) -> IngestResult:
    storage = storage or StorageService()
    data = path.read_bytes()
    return await ingest_bytes(
        session,
        owner_id=owner_id,
        data=data,
        filename=path.name,
        folder_id=folder_id,
        relative_path=relative_path,
        on_duplicate=on_duplicate,
        storage=storage,
        priority=priority,
    )


async def move_document(
    session: AsyncSession,
    document_id: uuid.UUID,
    folder_id: uuid.UUID,
    *,
    owner_id: uuid.UUID,
) -> Document:
    doc = await get_document(session, document_id, owner_id=owner_id)
    folder = await folder_service.get_folder(session, folder_id, owner_id=owner_id)
    if folder.kind.value == "trash":
        raise ValidationError("Use trash endpoint to move documents to Trash")
    doc.folder_id = folder_id
    doc.inbox = folder.kind.value == "inbox"
    doc.is_trashed = False
    doc.trashed_at = None
    doc.modified_date = datetime.now(UTC)
    await session.flush()
    session.expire(doc, ["folder"])
    return await get_document(session, doc.id, owner_id=owner_id)


async def trash_document(
    session: AsyncSession, document_id: uuid.UUID, *, owner_id: uuid.UUID
) -> Document:
    doc = await get_document(session, document_id, owner_id=owner_id)
    if doc.is_trashed:
        return doc
    trash = await folder_service.get_trash(session, owner_id)
    doc.trashed_from_folder_id = doc.folder_id
    doc.folder_id = trash.id
    doc.is_trashed = True
    doc.trashed_at = datetime.now(UTC)
    doc.inbox = False
    doc.modified_date = datetime.now(UTC)
    await session.flush()
    return await get_document(session, doc.id, owner_id=owner_id)


async def restore_document(
    session: AsyncSession,
    document_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    *,
    owner_id: uuid.UUID,
) -> Document:
    doc = await get_document(session, document_id, owner_id=owner_id)
    if not doc.is_trashed:
        return doc

    target_id = folder_id
    if target_id is None and doc.trashed_from_folder_id is not None:
        origin = await session.get(Folder, doc.trashed_from_folder_id)
        if (
            origin is not None
            and origin.owner_id == owner_id
            and not origin.is_trashed
            and origin.kind != FolderKind.TRASH
        ):
            target_id = origin.id

    if target_id is None:
        inbox = await folder_service.get_inbox(session, owner_id)
        target_id = inbox.id
    else:
        target = await folder_service.get_folder(session, target_id, owner_id=owner_id)
        if target.is_trashed or target.kind == FolderKind.TRASH:
            inbox = await folder_service.get_inbox(session, owner_id)
            target_id = inbox.id

    doc.folder_id = target_id
    doc.is_trashed = False
    doc.trashed_at = None
    doc.trashed_from_folder_id = None
    doc.inbox = target_id == (await folder_service.get_inbox(session, owner_id)).id
    doc.modified_date = datetime.now(UTC)
    await session.flush()
    return await get_document(session, doc.id, owner_id=owner_id)


async def permanently_delete(
    session: AsyncSession,
    document_id: uuid.UUID,
    *,
    owner_id: uuid.UUID | None = None,
    storage: StorageService | None = None,
) -> None:
    storage = storage or StorageService()
    doc = await get_document(session, document_id, owner_id=owner_id)
    if not doc.is_trashed:
        raise ValidationError("Document must be in Trash before permanent deletion")
    storage_key = doc.storage_key
    thumb = doc.thumbnail_key
    preview = doc.preview_key
    shared_storage = (
        await session.execute(
            select(func.count())
            .select_from(Document)
            .where(
                Document.storage_key == storage_key,
                Document.id != doc.id,
            )
        )
    ).scalar_one()
    await session.delete(doc)
    await session.flush()
    if not shared_storage:
        await storage.delete_original(storage_key)
    await storage.delete_derived("thumbnail", thumb)
    await storage.delete_derived("preview", preview)


async def purge_expired_trash(
    session: AsyncSession,
    *,
    owner_id: uuid.UUID | None = None,
    retention_days: int | None = None,
    storage: StorageService | None = None,
) -> dict[str, int]:
    """Permanently delete trash items older than the retention window."""
    from datetime import timedelta

    from folium.core.config import get_settings

    settings = get_settings()
    days = retention_days if retention_days is not None else settings.trash_retention_days
    cutoff = datetime.now(UTC) - timedelta(days=days)
    storage = storage or StorageService()

    expired_docs_stmt = select(Document.id).where(
        Document.is_trashed.is_(True),
        Document.trashed_at.is_not(None),
        Document.trashed_at < cutoff,
    )
    if owner_id is not None:
        expired_docs_stmt = expired_docs_stmt.where(Document.owner_id == owner_id)
    expired_docs = (await session.execute(expired_docs_stmt)).scalars().all()

    deleted_docs = 0
    for doc_id in expired_docs:
        try:
            await permanently_delete(
                session,
                doc_id,
                owner_id=owner_id,
                storage=storage,
            )
            deleted_docs += 1
        except Exception:
            # Continue purging remaining items
            continue

    # Delete empty trashed folders oldest-first (children before parents via depth)
    expired_folders_stmt = (
        select(Folder)
        .where(
            Folder.is_trashed.is_(True),
            Folder.kind == FolderKind.NORMAL,
            Folder.trashed_at.is_not(None),
            Folder.trashed_at < cutoff,
        )
        .order_by(Folder.trashed_at.asc())
    )
    if owner_id is not None:
        expired_folders_stmt = expired_folders_stmt.where(Folder.owner_id == owner_id)
    expired_folders = (await session.execute(expired_folders_stmt)).scalars().all()

    deleted_folders = 0
    # Multiple passes to delete leaves first
    remaining = list(expired_folders)
    for _ in range(len(remaining) + 1):
        if not remaining:
            break
        next_remaining: list[Folder] = []
        for folder in remaining:
            child_count = (
                await session.execute(
                    select(func.count()).select_from(Folder).where(Folder.parent_id == folder.id)
                )
            ).scalar_one()
            doc_count = (
                await session.execute(
                    select(func.count())
                    .select_from(Document)
                    .where(Document.folder_id == folder.id)
                )
            ).scalar_one()
            if child_count or doc_count:
                next_remaining.append(folder)
                continue
            await session.delete(folder)
            deleted_folders += 1
        await session.flush()
        if len(next_remaining) == len(remaining):
            break
        remaining = next_remaining

    return {
        "deleted_documents": deleted_docs,
        "deleted_folders": deleted_folders,
        "retention_days": days,
    }


async def empty_trash(
    session: AsyncSession,
    *,
    owner_id: uuid.UUID | None = None,
    storage: StorageService | None = None,
) -> dict[str, int]:
    """Permanently delete all trashed documents and empty trashed folders now."""
    storage = storage or StorageService()
    doc_ids_stmt = select(Document.id).where(Document.is_trashed.is_(True))
    if owner_id is not None:
        doc_ids_stmt = doc_ids_stmt.where(Document.owner_id == owner_id)
    doc_ids = (await session.execute(doc_ids_stmt)).scalars().all()
    deleted_docs = 0
    for doc_id in doc_ids:
        await permanently_delete(
            session,
            doc_id,
            owner_id=owner_id,
            storage=storage,
        )
        deleted_docs += 1

    if owner_id is None:
        trashed_folders = (
            (
                await session.execute(
                    select(Folder).where(
                        Folder.is_trashed.is_(True),
                        Folder.kind == FolderKind.NORMAL,
                    )
                )
            )
            .scalars()
            .all()
        )
    else:
        trashed_folders = await folder_service.list_trashed_folders(session, owner_id)
    deleted_folders = 0
    remaining = list(trashed_folders)
    for _ in range(len(remaining) + 1):
        if not remaining:
            break
        next_remaining: list[Folder] = []
        for folder in remaining:
            try:
                await folder_service.permanently_delete_trashed_folder(
                    session,
                    folder.id,
                    owner_id=folder.owner_id,
                )
                deleted_folders += 1
            except Exception:
                next_remaining.append(folder)
        if len(next_remaining) == len(remaining):
            break
        remaining = next_remaining

    return {
        "deleted_documents": deleted_docs,
        "deleted_folders": deleted_folders,
    }


async def update_metadata(
    session: AsyncSession,
    document_id: uuid.UUID,
    data: dict,
    *,
    owner_id: uuid.UUID,
) -> Document:
    doc = await get_document(session, document_id, owner_id=owner_id)
    if "title" in data and data["title"] is not None:
        doc.title = data["title"].strip()
    if "folder_id" in data and data["folder_id"] is not None:
        await move_document(
            session,
            document_id,
            data["folder_id"],
            owner_id=owner_id,
        )
        doc = await get_document(session, document_id, owner_id=owner_id)
    if "document_type_id" in data:
        type_id = data["document_type_id"]
        if type_id is not None:
            document_type = await session.get(DocumentType, type_id)
            if document_type is None or document_type.owner_id != owner_id:
                raise NotFoundError("Document type not found")
        doc.document_type_id = type_id
    if "correspondent_id" in data:
        correspondent_id = data["correspondent_id"]
        if correspondent_id is not None:
            correspondent = await session.get(Correspondent, correspondent_id)
            if correspondent is None or correspondent.owner_id != owner_id:
                raise NotFoundError("Correspondent not found")
        doc.correspondent_id = correspondent_id
    if "created_date" in data:
        doc.created_date = data["created_date"]
    if "effective_date" in data:
        doc.effective_date = data["effective_date"]
    if "language" in data:
        doc.language = data["language"]
    if "notes" in data:
        doc.notes = data["notes"]
    if "custom_fields" in data and data["custom_fields"] is not None:
        doc.custom_fields = data["custom_fields"]
    if "inbox" in data and data["inbox"] is not None:
        doc.inbox = data["inbox"]
    if "is_archived" in data and data["is_archived"] is not None:
        doc.is_archived = data["is_archived"]
    if "needs_review" in data and data["needs_review"] is not None:
        doc.needs_review = data["needs_review"]
    if "tag_ids" in data and data["tag_ids"] is not None:
        tags = (
            (
                await session.execute(
                    select(Tag).where(
                        Tag.owner_id == owner_id,
                        Tag.id.in_(data["tag_ids"]),
                    )
                )
            )
            .scalars()
            .all()
        )
        if len(tags) != len(set(data["tag_ids"])):
            raise NotFoundError("One or more tags not found")
        doc.tags = list(tags)
    doc.modified_date = datetime.now(UTC)
    await session.flush()
    return await get_document(session, doc.id, owner_id=owner_id)


async def list_documents(
    session: AsyncSession,
    *,
    owner_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    include_descendants: bool = False,
    inbox: bool | None = None,
    trashed: bool = False,
    tag_ids: list[uuid.UUID] | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
    sort: str = "added_date",
    order: str = "desc",
) -> tuple[list[Document], int]:
    stmt: Select = (
        select(Document).options(*_document_options()).where(Document.owner_id == owner_id)
    )
    count_stmt = select(func.count(Document.id)).where(Document.owner_id == owner_id)

    if trashed:
        stmt = stmt.where(Document.is_trashed.is_(True))
        count_stmt = count_stmt.where(Document.is_trashed.is_(True))
    else:
        stmt = stmt.where(Document.is_trashed.is_(False))
        count_stmt = count_stmt.where(Document.is_trashed.is_(False))

    if inbox is True:
        stmt = stmt.where(Document.inbox.is_(True))
        count_stmt = count_stmt.where(Document.inbox.is_(True))

    if folder_id is not None:
        await folder_service.get_folder(session, folder_id, owner_id=owner_id)
        if include_descendants:
            ids = await folder_service.descendant_ids(
                session,
                folder_id,
                owner_id=owner_id,
            )
            stmt = stmt.where(Document.folder_id.in_(ids))
            count_stmt = count_stmt.where(Document.folder_id.in_(ids))
        else:
            stmt = stmt.where(Document.folder_id == folder_id)
            count_stmt = count_stmt.where(Document.folder_id == folder_id)

    if tag_ids:
        for tag_id in tag_ids:
            stmt = stmt.where(Document.tags.any(Tag.id == tag_id))
            count_stmt = count_stmt.where(Document.tags.any(Tag.id == tag_id))

    if q:
        pattern = f"%{q}%"
        filt = or_(
            Document.title.ilike(pattern),
            Document.original_filename.ilike(pattern),
            Document.notes.ilike(pattern),
        )
        stmt = stmt.where(filt)
        count_stmt = count_stmt.where(filt)

    sort_map = {
        "added_date": Document.added_date,
        "title": Document.title,
        "modified_date": Document.modified_date,
        "created_date": Document.created_date,
    }
    sort_col = sort_map.get(sort, Document.added_date)
    if order.lower() == "asc":
        stmt = stmt.order_by(sort_col.asc())
    else:
        stmt = stmt.order_by(sort_col.desc())

    total = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = list((await session.execute(stmt)).scalars().unique().all())
    return items, total


def _purge_after(trashed_at: datetime | None) -> datetime | None:
    if trashed_at is None:
        return None
    from datetime import timedelta

    from folium.core.config import get_settings

    return trashed_at + timedelta(days=get_settings().trash_retention_days)


def document_to_dict(doc: Document) -> dict:
    return {
        "id": doc.id,
        "title": doc.title,
        "original_filename": doc.original_filename,
        "mime_type": doc.mime_type,
        "file_size": doc.file_size,
        "page_count": doc.page_count,
        "language": doc.language,
        "notes": doc.notes,
        "archive_serial": doc.archive_serial,
        "folder_id": doc.folder_id,
        "folder_path": doc.folder.path_cache if doc.folder else None,
        "document_type_id": doc.document_type_id,
        "document_type_name": doc.document_type.name if doc.document_type else None,
        "correspondent_id": doc.correspondent_id,
        "correspondent_name": doc.correspondent.name if doc.correspondent else None,
        "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in doc.tags],
        "created_date": doc.created_date,
        "effective_date": doc.effective_date,
        "added_date": doc.added_date,
        "modified_date": doc.modified_date,
        "indexed_at": doc.indexed_at,
        "processing_status": doc.processing_status.value,
        "ocr_completed": doc.ocr_completed,
        "text_extracted": doc.text_extracted,
        "document_indexed": doc.document_indexed,
        "has_embeddings": doc.has_embeddings,
        "processing_error": doc.processing_error,
        "is_archived": doc.is_archived,
        "is_trashed": doc.is_trashed,
        "trashed_at": doc.trashed_at,
        "trashed_from_folder_id": doc.trashed_from_folder_id,
        "purge_after": _purge_after(doc.trashed_at),
        "inbox": doc.inbox,
        "needs_review": doc.needs_review,
        "custom_fields": doc.custom_fields or {},
        "ai_summary": doc.ai_summary,
        "ai_summary_meta": doc.ai_summary_meta,
        "has_thumbnail": bool(doc.thumbnail_key),
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
    }
