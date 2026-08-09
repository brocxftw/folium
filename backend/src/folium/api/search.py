"""Search endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from folium.ai.registry import get_adapter
from folium.api.schemas import DocumentOut, SearchHit, SearchRequest, SearchResponse
from folium.auth.deps import CurrentUser
from folium.bootstrap import ensure_ai_settings
from folium.db.session import get_db
from folium.models import AIProvider
from folium.search.fts import search_documents
from folium.search.hybrid import hybrid_search
from folium.search.semantic import search_chunks_semantic
from folium.services import documents as doc_service
from folium.services import folders as folder_service

router = APIRouter(prefix="/api/search", tags=["search"])


async def _resolve_folder_ids(
    db: AsyncSession,
    folder_id: uuid.UUID | None,
    folder_ids: list[uuid.UUID] | None,
    include_descendants: bool,
    owner_id: uuid.UUID,
) -> list[uuid.UUID] | None:
    if folder_ids:
        for candidate_id in folder_ids:
            await folder_service.get_folder(db, candidate_id, owner_id=owner_id)
        return folder_ids
    if folder_id is None:
        return None
    await folder_service.get_folder(db, folder_id, owner_id=owner_id)
    if include_descendants:
        return await folder_service.descendant_ids(
            db,
            folder_id,
            owner_id=owner_id,
        )
    return [folder_id]


@router.post("", response_model=SearchResponse)
async def search(
    body: SearchRequest,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SearchResponse:
    ai_settings = await ensure_ai_settings(db)
    semantic_available = False
    query_embedding: list[float] | None = None
    embed_provider_name: str | None = None
    embed_model: str | None = None
    embed_dim: int | None = None

    if ai_settings.embedding_provider_id is not None:
        provider = await db.get(AIProvider, ai_settings.embedding_provider_id)
        if provider is not None and provider.enabled and provider.embedding_model:
            semantic_available = True
            embed_provider_name = ai_settings.active_embedding_provider or provider.name
            embed_model = ai_settings.active_embedding_model or provider.embedding_model
            embed_dim = ai_settings.active_embedding_dimension
            if body.mode in {"semantic", "hybrid"} and body.query.strip():
                adapter = get_adapter(provider)
                try:
                    result = await adapter.embed([body.query], model=embed_model)
                    if result.embeddings:
                        query_embedding = result.embeddings[0]
                        if embed_dim is None and query_embedding:
                            embed_dim = len(query_embedding)
                finally:
                    await adapter.aclose()

    resolved_folder_ids = await _resolve_folder_ids(
        db,
        body.folder_id,
        body.folder_ids,
        body.include_descendants,
        _user.id,
    )

    hits: list[SearchHit] = []
    total = 0

    if body.mode == "keyword" or (body.mode == "hybrid" and not query_embedding):
        doc_hits = await search_documents(
            db,
            body.query,
            owner_id=_user.id,
            folder_ids=resolved_folder_ids,
            limit=body.page_size,
            offset=(body.page - 1) * body.page_size,
        )
        total = len(doc_hits)
        seen_docs: set[uuid.UUID] = set()
        for hit in doc_hits:
            if hit.document_id in seen_docs:
                continue
            seen_docs.add(hit.document_id)
            doc = await doc_service.get_document(db, hit.document_id, owner_id=_user.id)
            hits.append(
                SearchHit(
                    document=DocumentOut.model_validate(doc_service.document_to_dict(doc)),
                    score=hit.rank,
                    snippet=hit.snippet,
                )
            )

    elif (
        body.mode == "semantic"
        and query_embedding
        and embed_provider_name
        and embed_model
        and embed_dim
    ):
        sem_hits = await search_chunks_semantic(
            db,
            query_embedding,
            owner_id=_user.id,
            embedding_provider=embed_provider_name,
            embedding_model=embed_model,
            embedding_dimension=embed_dim,
            folder_ids=resolved_folder_ids,
            limit=body.page_size,
        )
        total = len(sem_hits)
        seen_docs = set()
        for hit in sem_hits:
            if hit.document_id in seen_docs:
                continue
            seen_docs.add(hit.document_id)
            doc = await doc_service.get_document(db, hit.document_id, owner_id=_user.id)
            hits.append(
                SearchHit(
                    document=DocumentOut.model_validate(doc_service.document_to_dict(doc)),
                    score=hit.score,
                    snippet=hit.text[:280] if hit.text else None,
                    page_number=hit.page_number,
                    chunk_id=hit.chunk_id,
                )
            )

    elif (
        body.mode == "hybrid"
        and query_embedding
        and embed_provider_name
        and embed_model
        and embed_dim
    ):
        hybrid_hits = await hybrid_search(
            db,
            body.query,
            query_embedding,
            owner_id=_user.id,
            embedding_provider=embed_provider_name,
            embedding_model=embed_model,
            embedding_dimension=embed_dim,
            folder_ids=resolved_folder_ids,
            limit=body.page_size,
        )
        total = len(hybrid_hits)
        seen_docs = set()
        for hit in hybrid_hits:
            if hit.document_id in seen_docs:
                continue
            seen_docs.add(hit.document_id)
            doc = await doc_service.get_document(db, hit.document_id, owner_id=_user.id)
            hits.append(
                SearchHit(
                    document=DocumentOut.model_validate(doc_service.document_to_dict(doc)),
                    score=hit.score,
                    snippet=hit.text[:280] if hit.text else None,
                    page_number=hit.page_number,
                    chunk_id=hit.chunk_id,
                )
            )
    else:
        doc_hits = await search_documents(
            db,
            body.query,
            owner_id=_user.id,
            folder_ids=resolved_folder_ids,
            limit=body.page_size,
            offset=(body.page - 1) * body.page_size,
        )
        total = len(doc_hits)
        for hit in doc_hits:
            doc = await doc_service.get_document(db, hit.document_id, owner_id=_user.id)
            hits.append(
                SearchHit(
                    document=DocumentOut.model_validate(doc_service.document_to_dict(doc)),
                    score=hit.rank,
                    snippet=hit.snippet,
                )
            )

    return SearchResponse(
        items=hits,
        total=total,
        mode=body.mode,
        semantic_available=semantic_available,
    )
