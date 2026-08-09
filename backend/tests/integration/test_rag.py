"""RAG / ask integration tests with mocked chat adapter."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from folium.ai.base import AIProviderAdapter, ChatMessage, ChatResult, EmbeddingResult, ModelCapabilities
from folium.models import DocumentChunk, Job, JobType


@dataclass
class _MockLocalChatAdapter(AIProviderAdapter):
    chunk_id: uuid.UUID
    provider_name: str = "mock-local"
    is_local: bool = True

    @property
    def capabilities(self) -> ModelCapabilities:
        return ModelCapabilities(supports_chat=True)

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float = 0.2,
    ) -> ChatResult:
        return ChatResult(
            content=f"The loan amount is RM 420,000 [chunk:{self.chunk_id}].",
            model=model or "mock-local",
            input_tokens=100,
            output_tokens=20,
        )

    async def embed(
        self,
        texts: list[str],
        *,
        model: str | None = None,
    ) -> EmbeddingResult:
        return EmbeddingResult(embeddings=[], model=model or "mock")

    async def test_connection(self) -> bool:
        return True

    async def aclose(self) -> None:
        return None


@dataclass
class _MockInsufficientAdapter(AIProviderAdapter):
    provider_name: str = "mock-insufficient"
    is_local: bool = True

    @property
    def capabilities(self) -> ModelCapabilities:
        return ModelCapabilities(supports_chat=True)

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float = 0.2,
    ) -> ChatResult:
        return ChatResult(content="INSUFFICIENT_EVIDENCE", model=model or "mock")

    async def embed(
        self,
        texts: list[str],
        *,
        model: str | None = None,
    ) -> EmbeddingResult:
        return EmbeddingResult(embeddings=[], model=model or "mock")

    async def test_connection(self) -> bool:
        return True

    async def aclose(self) -> None:
        return None


async def _setup_local_chat_provider(auth_client: AsyncClient) -> str:
    provider = await auth_client.post(
        "/api/ai/providers",
        json={
            "name": "local-chat",
            "kind": "ollama",
            "base_url": "http://localhost:11434",
            "is_local": True,
            "chat_model": "llama-test",
        },
    )
    assert provider.status_code == 201
    provider_id = provider.json()["id"]

    policy = await auth_client.patch(
        "/api/ai/policy",
        json={
            "chat_provider_id": provider_id,
            "warn_before_remote": False,
        },
    )
    assert policy.status_code == 200
    return provider_id


@pytest.mark.asyncio
async def test_ask_returns_answer_with_valid_citations(
    auth_client: AsyncClient,
    uploaded_txt_doc: dict,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await _setup_local_chat_provider(auth_client)

    chunk = (
        await db_session.execute(
            select(DocumentChunk).where(
                DocumentChunk.document_id == uuid.UUID(uploaded_txt_doc["id"])
            )
        )
    ).scalars().first()
    assert chunk is not None

    monkeypatch.setattr(
        "folium.api.documents.get_adapter",
        lambda provider, api_key=None: _MockLocalChatAdapter(chunk_id=chunk.id),
    )

    response = await auth_client.post(
        f"/api/documents/{uploaded_txt_doc['id']}/ask",
        json={"question": "What is the LPPSA loan amount?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["insufficient_evidence"] is False
    assert "420" in body["answer"]
    assert body["citations"]
    assert str(chunk.id) in body["answer"] or any(
        str(c["chunk_id"]) == str(chunk.id) for c in body["citations"]
    )


@pytest.mark.asyncio
async def test_ask_insufficient_evidence_path(
    auth_client: AsyncClient,
    uploaded_txt_doc: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await _setup_local_chat_provider(auth_client)
    monkeypatch.setattr(
        "folium.api.documents.get_adapter",
        lambda provider, api_key=None: _MockInsufficientAdapter(),
    )

    response = await auth_client.post(
        f"/api/documents/{uploaded_txt_doc['id']}/ask",
        json={"question": "What is the borrower's shoe size?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["insufficient_evidence"] is True
    assert body["citations"] == []
