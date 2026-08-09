"""Workspace-wide ask / RAG endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from folium.ai.rag import RAGScope
from folium.ai.rag import ask as rag_ask
from folium.ai.registry import get_adapter
from folium.api.schemas import AskRequest, AskResponse, CitationOut
from folium.auth.deps import CurrentUser, SafeSession
from folium.bootstrap import ensure_ai_settings
from folium.core.exceptions import PrivacyViolationError, ValidationError
from folium.db.session import get_db
from folium.models import AIProvider

router = APIRouter(prefix="/api/ask", tags=["ask"])


@router.post("", response_model=AskResponse)
async def ask_workspace(
    body: AskRequest,
    _sess: SafeSession,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AskResponse:
    settings_row = await ensure_ai_settings(db)
    if settings_row.chat_provider_id is None:
        raise ValidationError("No chat provider configured")

    chat_provider = await db.get(AIProvider, settings_row.chat_provider_id)
    if chat_provider is None or not chat_provider.enabled:
        raise ValidationError("Chat provider is not available")

    if settings_row.warn_before_remote and not chat_provider.is_local and not body.confirm_remote:
        raise PrivacyViolationError("Remote AI usage requires confirm_remote=true")

    embed_adapter = None
    if settings_row.embedding_provider_id is not None:
        embed_provider = await db.get(AIProvider, settings_row.embedding_provider_id)
        if embed_provider is not None and embed_provider.enabled:
            embed_adapter = get_adapter(embed_provider)

    scope = RAGScope(
        kind=body.scope,
        document_id=body.document_id,
        document_ids=body.document_ids or [],
        folder_id=body.folder_id,
        search_query=body.search_query,
    )

    result = await rag_ask(
        db,
        owner_id=_user.id,
        question=body.question,
        settings=settings_row,
        chat_provider=chat_provider,
        chat_adapter=get_adapter(chat_provider),
        scope=scope,
        embed_adapter=embed_adapter,
    )

    return AskResponse(
        answer=result.answer,
        citations=[
            CitationOut(
                document_id=c.document_id,
                page_number=c.page_number,
                chunk_id=c.chunk_id,
                title=c.title,
                quote=c.quote,
            )
            for c in result.citations
        ],
        passages=[
            CitationOut(
                document_id=c.document_id,
                page_number=c.page_number,
                chunk_id=c.chunk_id,
                title=c.title,
                quote=c.quote,
            )
            for c in result.passages
        ],
        provider=result.provider,
        model=result.model,
        privacy_mode=settings_row.privacy_mode.value,
        is_local=chat_provider.is_local,
        insufficient_evidence=result.insufficient_evidence,
    )
