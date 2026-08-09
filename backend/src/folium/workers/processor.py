"""Background job processing."""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from datetime import UTC, datetime
from functools import partial

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
    AISuggestion,
    Correspondent,
    Document,
    DocumentChunk,
    DocumentPage,
    DocumentType,
    Folder,
    FolderKind,
    Job,
    JobStatus,
    JobType,
    ProcessingStatus,
    SuggestionStatus,
    Tag,
)
from folium.ocr.extractor import (
    ExtractedPage,
    detect_language_hint,
    extract_document,
    pages_need_ocr,
)
from folium.ocr.paddle_engine import get_ocr_executor
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

# Align with metadata-suggestion minimum; below this, scanned PDFs need OCR first.
_MIN_TEXT_FOR_AI = 20

PREFLIGHT_JOB_TYPES = frozenset(
    {
        JobType.TEXT_EXTRACTION,
        JobType.OCR,
        JobType.METADATA_SUGGESTION,
    }
)


async def _get_document(session: AsyncSession, document_id: uuid.UUID) -> Document:
    doc = await session.get(Document, document_id)
    if doc is None:
        raise ValueError(f"Document {document_id} not found")
    return doc


async def _has_open_preflight_jobs(
    session: AsyncSession,
    document_id: uuid.UUID,
    *,
    exclude_job_id: uuid.UUID | None = None,
) -> bool:
    stmt = select(Job.id).where(
        Job.document_id == document_id,
        Job.job_type.in_(PREFLIGHT_JOB_TYPES),
        Job.status.in_([JobStatus.QUEUED, JobStatus.RUNNING]),
    )
    if exclude_job_id is not None:
        stmt = stmt.where(Job.id != exclude_job_id)
    return (await session.execute(stmt.limit(1))).scalar_one_or_none() is not None


async def mark_preflight_ready(
    session: AsyncSession,
    document_id: uuid.UUID,
    *,
    exclude_job_id: uuid.UUID | None = None,
) -> None:
    """Mark inbox/library doc ready for review when pre-flight jobs are done."""
    if await _has_open_preflight_jobs(session, document_id, exclude_job_id=exclude_job_id):
        return
    doc = await _get_document(session, document_id)
    if doc.processing_status == ProcessingStatus.FAILED:
        return
    doc.processing_status = ProcessingStatus.READY
    doc.processing_error = None
    await session.flush()


async def mark_preflight_failed(
    session: AsyncSession, document_id: uuid.UUID, error: str
) -> None:
    doc = await _get_document(session, document_id)
    doc.processing_status = ProcessingStatus.FAILED
    doc.processing_error = error[:2000]
    await session.flush()


def _has_usable_extracted_text(doc: Document) -> bool:
    return len((doc.extracted_text or "").strip()) >= _MIN_TEXT_FOR_AI


def _pages_from_extracted_text(text: str) -> list[ExtractedPage]:
    parts = [p.strip() for p in (text or "").split("\n\n")]
    pages = [ExtractedPage(page_number=i + 1, text=part) for i, part in enumerate(parts) if part]
    return pages or [ExtractedPage(page_number=1, text=(text or "").strip())]


def _pdf_needs_ocr_before_ai(doc: Document, *, ocr_enabled: bool) -> bool:
    """True when AI filing must wait for a dedicated OCR pass."""
    if not ocr_enabled:
        return False
    if doc.mime_type != "application/pdf":
        return False
    if doc.ocr_completed:
        return False
    return pages_need_ocr(_pages_from_extracted_text(doc.extracted_text or ""))


async def _has_open_ocr_job(
    session: AsyncSession,
    document_id: uuid.UUID,
    *,
    exclude_job_id: uuid.UUID | None = None,
) -> bool:
    stmt = select(Job.id).where(
        Job.document_id == document_id,
        Job.job_type == JobType.OCR,
        Job.status.in_([JobStatus.QUEUED, JobStatus.RUNNING]),
    )
    if exclude_job_id is not None:
        stmt = stmt.where(Job.id != exclude_job_id)
    return (await session.execute(stmt.limit(1))).scalar_one_or_none() is not None


async def _enqueue_metadata_suggestion_or_finish(
    session: AsyncSession,
    doc: Document,
    *,
    priority: int,
    exclude_job_id: uuid.UUID | None = None,
) -> None:
    # Never start AI filing while OCR is still queued/running.
    if await _has_open_ocr_job(session, doc.id, exclude_job_id=exclude_job_id):
        logger.info(
            "Deferring metadata suggestion until OCR finishes for doc=%s",
            doc.id,
        )
        return

    ai_settings = await ensure_ai_settings(session)
    can_suggest = (
        ai_settings.auto_tagging
        and ai_settings.chat_provider_id is not None
        and _has_usable_extracted_text(doc)
    )
    if can_suggest:
        provider = await session.get(AIProvider, ai_settings.chat_provider_id)
        if provider is not None and provider.enabled:
            try:
                PrivacyGate(ai_settings, provider).assert_can_qa()
            except Exception:
                can_suggest = False
            else:
                await job_service.enqueue_job(
                    session,
                    job_type=JobType.METADATA_SUGGESTION,
                    document_id=doc.id,
                    priority=priority + 20,
                )
                return
    await mark_preflight_ready(session, doc.id, exclude_job_id=exclude_job_id)


async def process_text_extraction(session: AsyncSession, job: Job) -> dict:
    if job.document_id is None:
        raise ValueError("TEXT_EXTRACTION job requires document_id")
    doc = await _get_document(session, job.document_id)
    storage = StorageService()
    path = storage.open_original_path(doc.storage_key)
    settings = get_settings()

    # PDFs: native text only here. OCR is a separate job so AI can wait on it.
    # Images still OCR inline (that is their only text source).
    is_pdf = doc.mime_type == "application/pdf"
    extract_fn = partial(
        extract_document,
        path,
        doc.mime_type,
        settings=settings,
        language=doc.language,
        allow_ocr=not is_pdf,
    )
    # Paddle must run on its dedicated thread; native PDF extract can use the
    # default pool.
    if is_pdf:
        extracted = await asyncio.to_thread(extract_fn)
    else:
        loop = asyncio.get_running_loop()
        extracted = await loop.run_in_executor(get_ocr_executor(), extract_fn)
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
    # Native PDF extract never counts as OCR; images OCR inline during this job.
    if is_pdf:
        doc.ocr_completed = False
    else:
        doc.ocr_completed = extracted.method == "paddleocr" or "ocr" in extracted.method
    doc.language = (
        doc.language or extracted.language or detect_language_hint(doc.extracted_text or "")
    )
    doc.processing_status = ProcessingStatus.PROCESSING
    doc.processing_error = None
    await session.flush()

    await refresh_page_search_vectors(session, doc.id)
    await refresh_document_search_vector(session, doc.id)

    # Final indexing is gated behind Inbox "Process documents".
    # Thin/scanned PDFs must finish the dedicated OCR job before AI suggestions.
    if is_pdf and settings.ocr_enabled and pages_need_ocr(extracted.pages):
        await job_service.enqueue_job(
            session,
            job_type=JobType.OCR,
            document_id=doc.id,
            # Ahead of thumbnail so OCR → AI is not stuck behind preview work.
            priority=max((job.priority or 100) - 5, 1),
        )
        logger.info(
            "Enqueued OCR before metadata suggestion for doc=%s (text_len=%s, pages=%s)",
            doc.id,
            len((doc.extracted_text or "").strip()),
            len(extracted.pages),
        )
    else:
        await _enqueue_metadata_suggestion_or_finish(
            session,
            doc,
            priority=job.priority,
            exclude_job_id=job.id,
        )

    return {"page_count": doc.page_count, "method": extracted.method}


async def process_ocr(session: AsyncSession, job: Job) -> dict:
    """Run OCR for scanned PDFs, then enqueue AI filing suggestions."""
    if job.document_id is None:
        raise ValueError("OCR job requires document_id")
    doc = await _get_document(session, job.document_id)
    storage = StorageService()
    path = storage.open_original_path(doc.storage_key)
    settings = get_settings()

    # PP-OCRv6 must stay on the dedicated OCR thread (Paddle is not pool-safe).
    loop = asyncio.get_running_loop()
    extracted = await loop.run_in_executor(
        get_ocr_executor(),
        partial(
            extract_document,
            path,
            doc.mime_type,
            settings=settings,
            language=doc.language,
            force_ocr=True,
        ),
    )
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
    if extracted.language and not doc.language:
        doc.language = extracted.language
    elif not doc.language:
        doc.language = detect_language_hint(doc.extracted_text or "")
    await session.flush()

    await refresh_page_search_vectors(session, doc.id)
    await refresh_document_search_vector(session, doc.id)

    logger.info(
        "OCR finished for doc=%s method=%s text_len=%s; enqueueing AI if eligible",
        doc.id,
        extracted.method,
        len((doc.extracted_text or "").strip()),
    )
    await _enqueue_metadata_suggestion_or_finish(
        session,
        doc,
        priority=job.priority,
        exclude_job_id=job.id,
    )

    return {"ocr_completed": True, "method": extracted.method, "text_len": len(doc.extracted_text or "")}


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
    # Keep ready after final indexing (document already left inbox via Process).
    if doc.processing_status != ProcessingStatus.FAILED:
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
        max_tokens=provider.max_output_tokens or 1024,
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


_FOLDER_PATH_RE = re.compile(r"^[\w][\w /&'.-]{0,200}$", re.UNICODE)


def _normalize_folder_path(path: str) -> str:
    path = path.strip().strip("/")
    return re.sub(r"\s*/\s*", " / ", path)


def _is_system_folder_path(path: str) -> bool:
    """Inbox / Trash / bare Documents root are not valid filing targets."""
    normalized = path.replace(" / ", "/").strip("/").lower()
    if normalized in {"inbox", "trash", "documents", "documents/inbox", "documents/trash"}:
        return True
    return normalized.endswith("/inbox") or normalized.endswith("/trash")


def _parse_suggestion_json(content: str) -> dict:
    text = content.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            return {}
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return {}
    return data if isinstance(data, dict) else {}


async def process_metadata_suggestion(session: AsyncSession, job: Job) -> dict:
    """Generate filing suggestions for Inbox review (never auto-applied)."""
    if job.document_id is None:
        raise ValueError("METADATA_SUGGESTION job requires document_id")
    doc = await _get_document(session, job.document_id)

    # Hard gate: never file-suggest while OCR is still in flight.
    if await _has_open_ocr_job(session, doc.id, exclude_job_id=job.id):
        logger.info(
            "metadata_suggestion waiting for OCR on doc=%s; skipping this job",
            doc.id,
        )
        return {"skipped": True, "reason": "waiting_for_ocr"}

    settings = get_settings()
    if _pdf_needs_ocr_before_ai(doc, ocr_enabled=settings.ocr_enabled):
        await job_service.enqueue_job(
            session,
            job_type=JobType.OCR,
            document_id=doc.id,
            priority=(job.priority or 50) - 5,
        )
        logger.info(
            "metadata_suggestion enqueued OCR first for doc=%s; skipping this job",
            doc.id,
        )
        return {"skipped": True, "reason": "enqueued_ocr_first"}

    ai_settings = await ensure_ai_settings(session)

    if not ai_settings.auto_tagging or ai_settings.chat_provider_id is None:
        await mark_preflight_ready(session, doc.id, exclude_job_id=job.id)
        return {"skipped": True, "reason": "auto_tagging_disabled"}

    provider = await session.get(AIProvider, ai_settings.chat_provider_id)
    if provider is None or not provider.enabled:
        await mark_preflight_ready(session, doc.id, exclude_job_id=job.id)
        return {"skipped": True, "reason": "provider_unavailable"}

    text = (doc.extracted_text or "").strip()
    if len(text) < _MIN_TEXT_FOR_AI:
        doc.needs_review = True
        await mark_preflight_ready(session, doc.id, exclude_job_id=job.id)
        return {"skipped": True, "reason": "insufficient_text"}

    PrivacyGate(ai_settings, provider).assert_can_qa()
    await assert_ai_quota(session, doc.owner_id)

    folders = (
        (
            await session.execute(
                select(Folder).where(
                    Folder.owner_id == doc.owner_id,
                    Folder.is_trashed.is_(False),
                    Folder.kind == FolderKind.NORMAL,
                )
            )
        )
        .scalars()
        .all()
    )
    folder_paths = sorted(
        {f.path_cache for f in folders if f.path_cache},
        key=len,
    )
    types = (
        (
            await session.execute(
                select(DocumentType).where(DocumentType.owner_id == doc.owner_id)
            )
        )
        .scalars()
        .all()
    )
    correspondents = (
        (
            await session.execute(
                select(Correspondent).where(Correspondent.owner_id == doc.owner_id)
            )
        )
        .scalars()
        .all()
    )
    tags = (
        (await session.execute(select(Tag).where(Tag.owner_id == doc.owner_id))).scalars().all()
    )

    type_names = [t.name for t in types]
    correspondent_names = [c.name for c in correspondents]
    tag_names = [t.name for t in tags]

    prompt = (
        "You help file documents into a personal archive. "
        "Return ONLY valid JSON with keys: "
        "folder_path (string using ' / ' separators, or null), "
        "create_folder (boolean — true if folder_path is not in Existing folders), "
        "title (string or null), "
        "document_type (string name or null), "
        "correspondent (string name or null), "
        "tags (array of short tag strings), "
        "needs_review (boolean — true if unsure).\n\n"
        "Folder rules:\n"
        "- Prefer a specific filing destination from the document subject "
        "(person, org, topic, year), e.g. 'Identity / Aishah Binti Abdul Azim' "
        "for a birth certificate or 'Finance / Salary / 2025' for a payslip.\n"
        "- Prefer an Existing folder when it clearly fits; otherwise invent a "
        "new path and set create_folder true.\n"
        "- Never suggest Inbox, Trash, or Documents alone.\n"
        "- Paths must use ' / ' between segments (not underscores).\n\n"
        f"Existing folders:\n{json.dumps(folder_paths[:80])}\n"
        f"Existing document types:\n{json.dumps(type_names)}\n"
        f"Existing correspondents:\n{json.dumps(correspondent_names)}\n"
        f"Existing tags:\n{json.dumps(tag_names)}\n\n"
        f"Filename: {doc.original_filename}\n"
        f"Document text:\n{text[:10000]}"
    )

    adapter = get_adapter(provider)
    # Thinking models (e.g. Qwen3) spend large budgets on reasoning_content
    # before emitting the final JSON in content. Too-low max_tokens truncates
    # mid-thought with empty content → zero suggestions.
    max_tokens = max(provider.max_output_tokens or 0, 48_000)
    result = await adapter.chat(
        [ChatMessage(role="user", content=prompt)],
        model=provider.chat_model,
        max_tokens=max_tokens,
        temperature=0.2,
    )
    await adapter.aclose()

    data = _parse_suggestion_json(result.content)
    if not data:
        logger.warning(
            "metadata_suggestion JSON parse empty for doc=%s finish=%s "
            "content_len=%s preview=%r",
            doc.id,
            result.finish_reason,
            len(result.content or ""),
            (result.content or "")[:240],
        )
    created = 0

    # Clear prior pending suggestions for this document
    await session.execute(
        delete(AISuggestion).where(
            AISuggestion.document_id == doc.id,
            AISuggestion.status == SuggestionStatus.PENDING,
        )
    )

    folder_path = data.get("folder_path")
    if isinstance(folder_path, str):
        folder_path = _normalize_folder_path(folder_path)
        if (
            folder_path
            and not _is_system_folder_path(folder_path)
            and _FOLDER_PATH_RE.match(folder_path.replace(" / ", "/"))
        ):
            normalized = folder_path.replace(" / ", "/")
            existing = next(
                (
                    f
                    for f in folders
                    if (f.path_cache or "").replace(" / ", "/") == normalized
                    or (f.path_cache or "") == folder_path
                ),
                None,
            )
            create_folder = existing is None
            if existing is None:
                # Also match leaf-only against path_cache ends
                for f in folders:
                    cache = (f.path_cache or "").replace(" / ", "/")
                    if cache.endswith("/" + normalized) or cache == normalized:
                        existing = f
                        create_folder = False
                        break
            value: dict = {
                "path": existing.path_cache if existing else folder_path,
                "exists": existing is not None,
                "create": create_folder,
            }
            if existing is not None:
                value["folder_id"] = str(existing.id)
            session.add(
                AISuggestion(
                    document_id=doc.id,
                    field="folder",
                    value=value,
                    status=SuggestionStatus.PENDING,
                    provider=provider.name,
                    model=result.model,
                )
            )
            created += 1
        elif folder_path and _is_system_folder_path(folder_path):
            logger.info(
                "metadata_suggestion ignored system folder_path=%r for doc=%s",
                folder_path,
                doc.id,
            )

    title = data.get("title")
    if isinstance(title, str) and title.strip():
        session.add(
            AISuggestion(
                document_id=doc.id,
                field="title",
                value={"title": title.strip()[:512]},
                status=SuggestionStatus.PENDING,
                provider=provider.name,
                model=result.model,
            )
        )
        created += 1

    doc_type_name = data.get("document_type")
    if isinstance(doc_type_name, str) and doc_type_name.strip():
        match = next(
            (t for t in types if t.name.lower() == doc_type_name.strip().lower()),
            None,
        )
        if match is not None:
            session.add(
                AISuggestion(
                    document_id=doc.id,
                    field="document_type",
                    value={
                        "document_type_id": str(match.id),
                        "name": match.name,
                    },
                    status=SuggestionStatus.PENDING,
                    provider=provider.name,
                    model=result.model,
                )
            )
            created += 1

    corr_name = data.get("correspondent")
    if isinstance(corr_name, str) and corr_name.strip():
        match = next(
            (c for c in correspondents if c.name.lower() == corr_name.strip().lower()),
            None,
        )
        if match is not None:
            session.add(
                AISuggestion(
                    document_id=doc.id,
                    field="correspondent",
                    value={
                        "correspondent_id": str(match.id),
                        "name": match.name,
                    },
                    status=SuggestionStatus.PENDING,
                    provider=provider.name,
                    model=result.model,
                )
            )
            created += 1

    suggested_tags = data.get("tags")
    if isinstance(suggested_tags, list):
        names = [
            str(n).strip()
            for n in suggested_tags
            if isinstance(n, str) and str(n).strip()
        ][:12]
        if names:
            session.add(
                AISuggestion(
                    document_id=doc.id,
                    field="tags",
                    value={"tag_names": names},
                    status=SuggestionStatus.PENDING,
                    provider=provider.name,
                    model=result.model,
                )
            )
            created += 1

    needs_review = bool(data.get("needs_review"))
    if not folder_path:
        needs_review = True
    doc.needs_review = needs_review

    await session.flush()
    await record_usage(
        session,
        user_id=doc.owner_id,
        provider=provider.name,
        model=result.model,
        operation="metadata_suggestion",
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        is_local=provider.is_local,
        document_id=doc.id,
    )
    await mark_preflight_ready(session, doc.id, exclude_job_id=job.id)
    return {"suggestions": created, "needs_review": needs_review}


async def process_job(session: AsyncSession, job: Job) -> dict:
    """Dispatch a job to the appropriate handler."""
    handlers = {
        JobType.TEXT_EXTRACTION: process_text_extraction,
        JobType.OCR: process_ocr,
        JobType.THUMBNAIL: process_thumbnail,
        JobType.INDEXING: process_indexing,
        JobType.EMBEDDING: process_embedding,
        JobType.SUMMARY: process_summary,
        JobType.METADATA_SUGGESTION: process_metadata_suggestion,
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
