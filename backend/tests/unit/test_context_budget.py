"""Context budget unit tests."""

from __future__ import annotations

from folium.ai.profiles import compute_budget


def test_compute_budget_subtracts_reserved_tokens() -> None:
    budget = compute_budget(
        max_context=8000,
        system=500,
        conversation=1000,
        response_reserve=1000,
    )
    assert budget.max_context == 8000
    assert budget.system == 500
    assert budget.conversation == 1000
    assert budget.response_reserve == 1000
    assert budget.rag_budget == 5500


def test_compute_budget_never_negative() -> None:
    budget = compute_budget(
        max_context=1000,
        system=400,
        conversation=400,
        response_reserve=400,
    )
    assert budget.rag_budget == 0
