"""AI profile presets and context budgeting."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict

from folium.models import AIProfileName, AISettings


class ProfilePreset(TypedDict):
    retrieved_chunks: int
    max_context_tokens: int
    max_output_tokens: int
    conversation_history_tokens: int
    parallel_llm_calls: int


PROFILE_PRESETS: dict[str, ProfilePreset] = {
    AIProfileName.LIGHTWEIGHT.value: {
        "retrieved_chunks": 3,
        "max_context_tokens": 8_000,
        "max_output_tokens": 1_000,
        "conversation_history_tokens": 2_000,
        "parallel_llm_calls": 1,
    },
    AIProfileName.BALANCED.value: {
        "retrieved_chunks": 8,
        "max_context_tokens": 16_000,
        "max_output_tokens": 2_000,
        "conversation_history_tokens": 4_000,
        "parallel_llm_calls": 2,
    },
    AIProfileName.QUALITY.value: {
        "retrieved_chunks": 16,
        "max_context_tokens": 32_000,
        "max_output_tokens": 4_000,
        "conversation_history_tokens": 8_000,
        "parallel_llm_calls": 3,
    },
}


@dataclass(frozen=True, slots=True)
class ProfileLimits:
    retrieved_chunks: int
    max_context_tokens: int
    max_output_tokens: int
    conversation_history_tokens: int
    parallel_llm_calls: int


@dataclass(frozen=True, slots=True)
class ContextBudget:
    max_context: int
    system: int
    conversation: int
    response_reserve: int
    rag_budget: int


def resolve_profile(settings_row: AISettings) -> ProfileLimits:
    """Return effective profile limits from presets or custom overrides."""
    if settings_row.profile == AIProfileName.CUSTOM:
        return ProfileLimits(
            retrieved_chunks=settings_row.retrieved_chunks,
            max_context_tokens=settings_row.max_context_tokens,
            max_output_tokens=settings_row.max_output_tokens,
            conversation_history_tokens=settings_row.conversation_history_tokens,
            parallel_llm_calls=settings_row.parallel_llm_calls,
        )

    preset = PROFILE_PRESETS[settings_row.profile.value]
    return ProfileLimits(
        retrieved_chunks=preset["retrieved_chunks"],
        max_context_tokens=preset["max_context_tokens"],
        max_output_tokens=preset["max_output_tokens"],
        conversation_history_tokens=preset["conversation_history_tokens"],
        parallel_llm_calls=preset["parallel_llm_calls"],
    )


def compute_budget(
    max_context: int,
    system: int,
    conversation: int,
    response_reserve: int,
) -> ContextBudget:
    """Compute how many tokens remain for retrieved RAG context."""
    reserved = system + conversation + response_reserve
    rag_budget = max(0, max_context - reserved)
    return ContextBudget(
        max_context=max_context,
        system=system,
        conversation=conversation,
        response_reserve=response_reserve,
        rag_budget=rag_budget,
    )
