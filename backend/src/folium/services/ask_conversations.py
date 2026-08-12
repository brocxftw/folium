"""Persist one active Ask conversation per owner+document."""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from folium.ai.base import ChatMessage
from folium.ai.rag import CITATION_PATTERN, Citation
from folium.models import AskConversation, AskMessage
from folium.services.chunking import estimate_tokens

logger = logging.getLogger(__name__)

ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"


def rewrite_answer_with_display_citations(
    answer: str,
    citations: list[Citation],
) -> tuple[str, list[dict[str, Any]]]:
    """Replace ``[chunk:<uuid>]`` with ``[1]…[n]`` using citation order.

    Only validated citations (already filtered by ``parse_citations``) get numbers.
    Unknown chunk markers are stripped so raw UUIDs never reach the UI.
    """
    id_to_number: dict[uuid.UUID, int] = {}
    snapshots: list[dict[str, Any]] = []
    for index, citation in enumerate(citations, start=1):
        id_to_number[citation.chunk_id] = index
        snapshots.append(
            {
                "display_number": index,
                "chunk_id": str(citation.chunk_id),
                "document_id": str(citation.document_id),
                "page_number": citation.page_number,
                "title": citation.title,
                "quote": citation.quote,
            }
        )

    def _replace(match: re.Match[str]) -> str:
        try:
            chunk_id = uuid.UUID(match.group(1))
        except ValueError:
            return ""
        number = id_to_number.get(chunk_id)
        if number is None:
            return ""
        return f"[{number}]"

    rewritten = CITATION_PATTERN.sub(_replace, answer)
    return normalize_display_citation_text(rewritten), snapshots


def normalize_display_citation_text(text: str) -> str:
    """Tidy display citation markers after chunk→number rewrite.

    - Collapse consecutive identical ``[n][n]`` (model often re-cites same chunk).
    - Keep punctuation attached to the citation badge.
    - Clean leftover spaces from stripped unknown markers.
    """
    cleaned = text
    previous = None
    while previous != cleaned:
        previous = cleaned
        cleaned = re.sub(r"\[(\d+)\](?:\s*)\[\1\]", r"[\1]", cleaned)
    cleaned = re.sub(r"\[(\d+)\]\s+([.,;:!?])", r"[\1]\2", cleaned)
    cleaned = re.sub(r"[^\S\n]{2,}", " ", cleaned)
    cleaned = re.sub(r"\s+([.,;:!?])", r"\1", cleaned)
    return cleaned


def select_history_for_model(
    messages: list[AskMessage],
    *,
    token_budget: int,
) -> list[ChatMessage]:
    """Prefer newest turns, then return chronological ChatMessages under budget."""
    if token_budget <= 0 or not messages:
        return []

    selected: list[AskMessage] = []
    used = 0
    for message in reversed(messages):
        tokens = estimate_tokens(message.content)
        if selected and used + tokens > token_budget:
            break
        selected.append(message)
        used += tokens

    selected.reverse()
    return [
        ChatMessage(role=message.role, content=message.content)  # type: ignore[arg-type]
        for message in selected
        if message.role in (ROLE_USER, ROLE_ASSISTANT)
    ]


async def get_or_create_conversation(
    session: AsyncSession,
    *,
    owner_id: uuid.UUID,
    document_id: uuid.UUID,
) -> AskConversation:
    existing = await session.scalar(
        select(AskConversation).where(
            AskConversation.owner_id == owner_id,
            AskConversation.document_id == document_id,
        )
    )
    if existing is not None:
        return existing

    conversation = AskConversation(owner_id=owner_id, document_id=document_id)
    session.add(conversation)
    await session.flush()
    return conversation


async def load_conversation_with_messages(
    session: AsyncSession,
    *,
    owner_id: uuid.UUID,
    document_id: uuid.UUID,
) -> AskConversation | None:
    return await session.scalar(
        select(AskConversation)
        .where(
            AskConversation.owner_id == owner_id,
            AskConversation.document_id == document_id,
        )
        .options(selectinload(AskConversation.messages))
    )


async def list_messages(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
) -> list[AskMessage]:
    result = await session.scalars(
        select(AskMessage)
        .where(AskMessage.conversation_id == conversation_id)
        .order_by(AskMessage.created_at.asc(), AskMessage.id.asc())
    )
    return list(result.all())


async def append_message(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    role: str,
    content: str,
    citations: list[dict[str, Any]] | None = None,
) -> AskMessage:
    message = AskMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
        citations=citations,
    )
    session.add(message)
    await session.flush()
    conversation = await session.get(AskConversation, conversation_id)
    if conversation is not None:
        from datetime import UTC, datetime

        conversation.updated_at = datetime.now(UTC)
    await session.flush()
    return message


async def clear_conversation(
    session: AsyncSession,
    *,
    owner_id: uuid.UUID,
    document_id: uuid.UUID,
) -> bool:
    """Delete the active conversation (and messages via CASCADE). Returns True if deleted."""
    conversation = await session.scalar(
        select(AskConversation).where(
            AskConversation.owner_id == owner_id,
            AskConversation.document_id == document_id,
        )
    )
    if conversation is None:
        return False
    await session.delete(conversation)
    await session.flush()
    return True


async def replace_with_new_conversation(
    session: AsyncSession,
    *,
    owner_id: uuid.UUID,
    document_id: uuid.UUID,
) -> AskConversation:
    """Drop any existing conversation and create a fresh empty one."""
    await session.execute(
        delete(AskConversation).where(
            AskConversation.owner_id == owner_id,
            AskConversation.document_id == document_id,
        )
    )
    conversation = AskConversation(owner_id=owner_id, document_id=document_id)
    session.add(conversation)
    await session.flush()
    return conversation
