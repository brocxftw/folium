"""Unit tests for Ask conversation helpers."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

from folium.ai.rag import Citation
from folium.services.ask_conversations import (
    rewrite_answer_with_display_citations,
    select_history_for_model,
)


def test_rewrite_answer_numbers_citations_in_order() -> None:
    c1 = uuid.uuid4()
    c2 = uuid.uuid4()
    citations = [
        Citation(
            document_id=uuid.uuid4(),
            page_number=1,
            chunk_id=c1,
            title="Doc",
            quote="first",
        ),
        Citation(
            document_id=uuid.uuid4(),
            page_number=2,
            chunk_id=c2,
            title="Doc",
            quote="second",
        ),
    ]
    answer = f"Start [chunk:{c1}] then later [chunk:{c2}] and again [chunk:{c1}]."
    rewritten, snaps = rewrite_answer_with_display_citations(answer, citations)
    assert rewritten == "Start [1] then later [2] and again [1]."
    assert [s["display_number"] for s in snaps] == [1, 2]
    assert snaps[0]["chunk_id"] == str(c1)


def test_rewrite_strips_unknown_chunk_markers() -> None:
    known = uuid.uuid4()
    unknown = uuid.uuid4()
    citations = [
        Citation(
            document_id=uuid.uuid4(),
            page_number=1,
            chunk_id=known,
            title="Doc",
            quote="q",
        )
    ]
    answer = f"Good [chunk:{known}] bad [chunk:{unknown}]."
    rewritten, snaps = rewrite_answer_with_display_citations(answer, citations)
    assert rewritten == "Good [1] bad ."
    assert len(snaps) == 1


def test_select_history_prefers_newest_under_budget() -> None:
    messages = [
        SimpleNamespace(role="user", content="a " * 50),
        SimpleNamespace(role="assistant", content="b " * 50),
        SimpleNamespace(role="user", content="latest question"),
    ]
    # Tiny budget should still keep the newest message.
    selected = select_history_for_model(messages, token_budget=8)  # type: ignore[arg-type]
    assert selected
    assert selected[-1].content == "latest question"
    assert selected[-1].role == "user"
