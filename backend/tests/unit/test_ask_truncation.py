"""Ask truncation must not be mislabeled as insufficient evidence."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from folium.ai.base import ChatResult
from folium.ai.rag import OUTPUT_TRUNCATED_MESSAGE, AskResult, ask
from folium.core.exceptions import ValidationError
from folium.models import AIProfileName, PrivacyMode


class _FakeAdapter:
    def __init__(self, result: ChatResult) -> None:
        self._result = result
        self.provider_name = "fake"
        self.is_local = True

    async def chat(self, messages, *, model=None, max_tokens=None, temperature=0.2):
        del messages, model, max_tokens, temperature
        return self._result

    async def aclose(self) -> None:
        return None


def _library_scope() -> SimpleNamespace:
    return SimpleNamespace(
        kind="library",
        document_id=None,
        document_ids=[],
        folder_id=None,
        search_query=None,
    )


def _lightweight_settings() -> SimpleNamespace:
    return SimpleNamespace(
        profile=AIProfileName.LIGHTWEIGHT,
        retrieved_chunks=3,
        max_context_tokens=8000,
        max_output_tokens=1024,
        conversation_history_tokens=2000,
        parallel_llm_calls=1,
        semantic_min_score=None,
        active_embedding_model=None,
        active_embedding_provider=None,
        active_embedding_dimension=None,
        privacy_mode=PrivacyMode.LOCAL_ONLY,
    )


@pytest.mark.asyncio
async def test_length_finish_without_citations_raises_truncation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    chunk_id = uuid.uuid4()
    chunk = SimpleNamespace(
        id=chunk_id,
        text="The warranty period is 24 months.",
        token_count=10,
        page_number=1,
    )
    retrieved = [
        SimpleNamespace(
            chunk=chunk,
            document_id=uuid.uuid4(),
            document_title="Manual",
            score=1.0,
            source="keyword",
        )
    ]

    async def _fake_resolve(*_a, **_k):
        return [uuid.uuid4()]

    async def _fake_retrieve(*_a, **_k):
        return retrieved

    monkeypatch.setattr("folium.ai.rag.resolve_scope_document_ids", _fake_resolve)
    monkeypatch.setattr("folium.ai.rag.hybrid_retrieve", _fake_retrieve)
    monkeypatch.setattr("folium.ai.rag.assert_ai_quota", AsyncMock())
    monkeypatch.setattr("folium.ai.rag.record_usage", AsyncMock())
    monkeypatch.setattr(
        "folium.ai.rag.PrivacyGate.assert_can_qa",
        lambda self: None,
    )

    provider = SimpleNamespace(
        name="local",
        context_window=None,
        chat_model="mock",
        is_local=True,
    )
    adapter = _FakeAdapter(
        ChatResult(
            content="The warranty is twenty-four months but I ran out of space",
            model="mock",
            input_tokens=100,
            output_tokens=1024,
            finish_reason="length",
        )
    )

    with pytest.raises(ValidationError, match="output tokens") as excinfo:
        await ask(
            AsyncMock(),
            question="What is the warranty period?",
            settings=_lightweight_settings(),  # type: ignore[arg-type]
            chat_provider=provider,  # type: ignore[arg-type]
            chat_adapter=adapter,  # type: ignore[arg-type]
            chat_model="mock",
            scope=_library_scope(),  # type: ignore[arg-type]
            owner_id=uuid.uuid4(),
        )
    assert OUTPUT_TRUNCATED_MESSAGE in str(excinfo.value.message)


@pytest.mark.asyncio
async def test_complete_answer_without_citations_is_insufficient_evidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    chunk_id = uuid.uuid4()
    chunk = SimpleNamespace(
        id=chunk_id,
        text="The warranty period is 24 months.",
        token_count=10,
        page_number=1,
    )
    retrieved = [
        SimpleNamespace(
            chunk=chunk,
            document_id=uuid.uuid4(),
            document_title="Manual",
            score=1.0,
            source="keyword",
        )
    ]

    async def _fake_resolve(*_a, **_k):
        return [uuid.uuid4()]

    async def _fake_retrieve(*_a, **_k):
        return retrieved

    monkeypatch.setattr("folium.ai.rag.resolve_scope_document_ids", _fake_resolve)
    monkeypatch.setattr("folium.ai.rag.hybrid_retrieve", _fake_retrieve)
    monkeypatch.setattr("folium.ai.rag.assert_ai_quota", AsyncMock())
    monkeypatch.setattr("folium.ai.rag.record_usage", AsyncMock())
    monkeypatch.setattr("folium.ai.rag.PrivacyGate.assert_can_qa", lambda self: None)

    provider = SimpleNamespace(
        name="local",
        context_window=None,
        chat_model="mock",
        is_local=True,
    )
    adapter = _FakeAdapter(
        ChatResult(
            content="I think the warranty is long but will not cite anything.",
            model="mock",
            finish_reason="stop",
        )
    )

    result = await ask(
        AsyncMock(),
        question="What is the warranty period?",
        settings=_lightweight_settings(),  # type: ignore[arg-type]
        chat_provider=provider,  # type: ignore[arg-type]
        chat_adapter=adapter,  # type: ignore[arg-type]
        chat_model="mock",
        scope=_library_scope(),  # type: ignore[arg-type]
        owner_id=uuid.uuid4(),
    )
    assert isinstance(result, AskResult)
    assert result.insufficient_evidence is True
