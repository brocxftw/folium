"""Background job processing."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from folium.ai.base import ChatMessage
from folium.ai.privacy import PrivacyGate
from folium.ai.registry import get_adapter
from folium.ai.usage import record_usage
from folium.bootstrap import ensure_ai_settings
from folium.core.config import get_settings
from folium.core.logging import get_logger
from folium.models import (
    AIProvider,
    Document,
    DocumentChunk,
    DocumentPage,
    Job,
    JobType,
    ProcessingStatus,
)
from folium.ocr.extractor import detect_language_hint, extract_document
from folium.ocr.previews import persist_previews
from folium.search.fts import (
    refresh_document_search_vector,
    refresh_page_search_vectors,
)
from folium.services import jobs as job_service
from folium.services.chunking import PageInput, chunk_pages
from folium.services.quotas import assert_ai_quota
from folium.storage.service import StorageService

logger = get_logger(__name__)


async def _get_document(session: AsyncSession, document_id: uuid.UUID) -> Document:
    doc = await session.get(Document, document_id)
    if doc is None:
        raise ValueError(f"Document {document_id} not found")
    return doc


async def process_text_extraction(session: AsyncSession, job: Job) -> dict:
    if job.document_id is None:
        raise ValueError("TEXT_EXTRACTION job requires document_id")
    doc = await _get_document(session, job.document_id)
    storage = StorageService()
    path = storage.open_original_path(doc.storage_key)
    settings = get_settings()

    extracted = extract_document(path, doc.mime_type, settings=settings, language=doc.language)
    await session.execute(delete(DocumentPage).where(DocumentPage.document_id == doc.id))

    full_text_parts: list[str] = []
    for page_data in extracted.pages:
        page = DocumentPage(
            document_id=doc.id,
            page_number=page_data.page_number,
            text=page_data.text,
        )
        session.add(page)
        if page_data.text.strip():
            full_text_parts.append(page_data.text)

    doc.page_count = extracted.page_count or len(extracted.pages)
    doc.extracted_text = "\n\n".join(full_text_parts)
    doc.text_extracted = True
    doc.ocr_completed = extracted.method != "pymupdf" and "ocr" in extracted.method
    doc.language = (
        doc.language or extracted.language or detect_language_hint(doc.extracted_text or "")
    )
    doc.processing_status = ProcessingStatus.PROCESSING
    doc.processing_error = None
    await session.flush()

    await refresh_page_search_vectors(session, doc.id)
    await refresh_document_search_vector(session, doc.id)

    await job_service.enqueue_job(
        session,
        job_type=JobType.INDEXING,
        document_id=doc.id,
        priority=job.priority + 5,
    )

    if settings.ocr_enabled and not doc.ocr_completed and doc.mime_type == "application/pdf":
        await job_service.enqueue_job(
            session,
            job_type=JobType.OCR,
            document_id=doc.id,
            priority=job.priority + 15,
        )

    return {"page_count": doc.page_count, "method": extracted.method}


async def process_ocr(session: AsyncSession, job: Job) -> dict:
    """Re-run OCR extraction for scanned PDFs."""
    if job.document_id is None:
        raise ValueError("OCR job requires document_id")
    doc = await _get_document(session, job.document_id)
    storage = StorageService()
    path = storage.open_original_path(doc.storage_key)
    settings = get_settings()

    extracted = extract_document(path, doc.mime_type, settings=settings, language=doc.language)
    await session.execute(delete(DocumentPage).where(DocumentPage.document_id == doc.id))

    full_text_parts: list[str] = []
    for page_data in extracted.pages:
        session.add(
            DocumentPage(
                document_id=doc.id,
                page_number=page_data.page_number,
                text=page_data.text,
            )
        )
        if page_data.text.strip():
            full_text_parts.append(page_data.text)

    doc.extracted_text = "\n\n".join(full_text_parts)
    doc.text_extracted = True
    doc.ocr_completed = True
    await session.flush()

    await refresh_page_search_vectors(session, doc.id)
    await refresh_document_search_vector(session, doc.id)

    await job_service.enqueue_job(
        session,
        job_type=JobType.INDEXING,
        document_id=doc.id,
        priority=job.priority,
    )

    return {"ocr_completed": True}


async def process_thumbnail(session: AsyncSession, job: Job) -> dict:
    if job.document_id is None:
        raise ValueError("THUMBNAIL job requires document_id")
    doc = await _get_document(session, job.document_id)
    storage = StorageService()
    path = storage.open_original_path(doc.storage_key)

    try:
        result = await persist_previews(
            storage,
            doc.id,
            path,
            doc.mime_type,
        )
    except Exception as exc:
        logger.warning("Thumbnail skipped for %s: %s", doc.id, exc)
        return {"skipped": True, "reason": str(exc)}

    doc.thumbnail_key = result.thumbnail_key
    doc.preview_key = result.preview_key
    await session.flush()
    return {"thumbnail_key": result.thumbnail_key}


async def process_indexing(session: AsyncSession, job: Job) -> dict:
    if job.document_id is None:
        raise ValueError("INDEXING job requires document_id")
    doc = await _get_document(session, job.document_id)

    pages = (
        (
            await session.execute(
                select(DocumentPage)
                .where(DocumentPage.document_id == doc.id)
                .order_by(DocumentPage.page_number)
            )
        )
        .scalars()
        .all()
    )

    page_inputs = [PageInput(page_number=p.page_number, text=p.text) for p in pages]
    drafts = chunk_pages(page_inputs)

    await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))

    for draft in drafts:
        session.add(
            DocumentChunk(
                document_id=doc.id,
                page_number=draft.page_number,
                section=draft.section,
                chunk_index=draft.chunk_index,
                text=draft.text,
                token_count=draft.token_count,
            )
        )

    doc.document_indexed = True
    doc.indexed_at = datetime.now(UTC)
    doc.processing_status = ProcessingStatus.READY
    await session.flush()

    await refresh_document_search_vector(session, doc.id)

    ai_settings = await ensure_ai_settings(session)
    if ai_settings.embedding_provider_id is not None:
        await job_service.enqueue_job(
            session,
            job_type=JobType.EMBEDDING,
            document_id=doc.id,
            priority=job.priority + 10,
        )

    if ai_settings.auto_enrichment and ai_settings.chat_provider_id is not None:
        await job_service.enqueue_job(
            session,
            job_type=JobType.SUMMARY,
            document_id=doc.id,
            priority=job.priority + 20,
        )

    return {"chunks": len(drafts)}


async def process_embedding(session: AsyncSession, job: Job) -> dict:
    if job.document_id is None:
        raise ValueError("EMBEDDING job requires document_id")
    doc = await _get_document(session, job.document_id)
    ai_settings = await ensure_ai_settings(session)

    if ai_settings.embedding_provider_id is None:
        return {"skipped": True, "reason": "no_embedding_provider"}

    provider = await session.get(AIProvider, ai_settings.embedding_provider_id)
    if provider is None or not provider.enabled or not provider.embedding_model:
        return {"skipped": True, "reason": "provider_unavailable"}

    PrivacyGate(ai_settings, provider).assert_can_embed()
    await assert_ai_quota(session, doc.owner_id)
    adapter = get_adapter(provider)

    chunks = (
        (
            await session.execute(
                select(DocumentChunk)
                .where(DocumentChunk.document_id == doc.id)
                .order_by(DocumentChunk.chunk_index)
            )
        )
        .scalars()
        .all()
    )

    if not chunks:
        return {"embedded": 0}

    texts = [c.text for c in chunks]
    model = ai_settings.active_embedding_model or provider.embedding_model
    result = await adapter.embed(texts, model=model)
    await adapter.aclose()

    if len(result.embeddings) != len(chunks):
        raise ValueError("Embedding count mismatch")

    dimension = len(result.embeddings[0]) if result.embeddings else None
    for chunk, vector in zip(chunks, result.embeddings, strict=True):
        chunk.embedding = vector
        chunk.embedding_provider = ai_settings.active_embedding_provider or provider.name
        chunk.embedding_model = result.model
        chunk.embedding_dimension = dimension

    doc.has_embeddings = True
    ai_settings.active_embedding_provider = provider.name
    ai_settings.active_embedding_model = result.model
    ai_settings.active_embedding_dimension = dimension
    await session.flush()

    await record_usage(
        session,
        user_id=doc.owner_id,
        provider=provider.name,
        model=result.model,
        operation="embedding",
        input_tokens=result.input_tokens,
        is_local=provider.is_local,
        document_id=doc.id,
    )

    return {"embedded": len(chunks), "dimension": dimension}


async def process_summary(session: AsyncSession, job: Job) -> dict:
    if job.document_id is None:
        raise ValueError("SUMMARY job requires document_id")
    doc = await _get_document(session, job.document_id)
    ai_settings = await ensure_ai_settings(session)

    if not ai_settings.auto_enrichment or ai_settings.chat_provider_id is None:
        return {"skipped": True}

    provider = await session.get(AIProvider, ai_settings.chat_provider_id)
    if provider is None or not provider.enabled:
        return {"skipped": True}

    text = (doc.extracted_text or "").strip()
    if len(text) < 50:
        return {"skipped": True, "reason": "insufficient_text"}

    PrivacyGate(ai_settings, provider).assert_can_qa()
    await assert_ai_quota(session, doc.owner_id)
    adapter = get_adapter(provider)

    prompt = (
        "Summarize the following document in 2-4 concise sentences. "
        "Do not invent facts not present in the text.\n\n"
        f"{text[:12000]}"
    )
    result = await adapter.chat(
        [ChatMessage(role="user", content=prompt)],
        model=provider.chat_model,
        max_tokens=500,
        temperature=0.3,
    )
    await adapter.aclose()

    doc.ai_summary = result.content.strip()
    doc.ai_summary_meta = {
        "provider": provider.name,
        "model": result.model,
        "generated_at": datetime.now(UTC).isoformat(),
    }
    await session.flush()

    await record_usage(
        session,
        user_id=doc.owner_id,
        provider=provider.name,
        model=result.model,
        operation="summary",
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        is_local=provider.is_local,
        document_id=doc.id,
    )

    return {"summary_length": len(doc.ai_summary or "")}


async def process_job(session: AsyncSession, job: Job) -> dict:
    """Dispatch a job to the appropriate handler."""
    handlers = {
        JobType.TEXT_EXTRACTION: process_text_extraction,
        JobType.OCR: process_ocr,
        JobType.THUMBNAIL: process_thumbnail,
        JobType.INDEXING: process_indexing,
        JobType.EMBEDDING: process_embedding,
        JobType.SUMMARY: process_summary,
    }
    handler = handlers.get(job.job_type)
    if handler is None:
        return {"skipped": True, "reason": f"unsupported job type: {job.job_type.value}"}
    return await handler(session, job)


async def process_consume_file(
    session: AsyncSession, path, storage: StorageService | None = None
) -> uuid.UUID | None:
    """Ingest a consume-folder file after stability and checksum verification.

    Files at the consume root go to Inbox. Nested paths recreate Folium folders
    under Documents root (e.g. ``consume/Finance/a.pdf`` → ``Documents / Finance``).

    Content duplicates (same SHA-256) are skipped and the source file is removed.
    """
    from pathlib import Path

    from folium.services.documents import ingest_path

    storage = storage or StorageService()
    source = Path(path)
    if not source.is_file():
        return None

    consume_root = storage.settings.consume_path.resolve()
    try:
        rel = source.resolve().relative_to(consume_root)
    except ValueError:
        rel = Path(source.name)

    relative_path = None if len(rel.parts) <= 1 else str(rel.as_posix())
    from folium.services import users as user_service

    owner = await user_service.resolve_consume_owner(session)

    result = await ingest_path(
        session,
        source,
        owner_id=owner.id,
        storage=storage,
        relative_path=relative_path,
        on_duplicate="skip",
        # Nested consume paths nest under Documents root; flat files use Inbox
        # via ingest_bytes default when relative_path is None.
        folder_id=None,
    )

    if result.status == "duplicate":
        source.unlink(missing_ok=True)
        return uuid.UUID(result.existing_document_id) if result.existing_document_id else None

    assert result.document is not None
    if storage.sha256_file(source) != result.document.checksum:
        raise ValueError("Checksum mismatch after ingest — source file retained")

    source.unlink(missing_ok=True)
    return result.document.id
