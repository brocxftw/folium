"""Folium AI integration layer."""

from __future__ import annotations

from folium.ai.base import (
    AIProviderAdapter,
    AIProviderError,
    ChatMessage,
    ChatResult,
    EmbeddingResult,
    ModelCapabilities,
)
from folium.ai.privacy import PrivacyGate
from folium.ai.profiles import ContextBudget, ProfileLimits, compute_budget, resolve_profile
from folium.ai.rag import AskResult, Citation, RAGScope, ask
from folium.ai.registry import get_adapter
from folium.ai.url_validation import ValidatedProviderURL, validate_provider_base_url
from folium.ai.usage import record_usage

__all__ = [
    "AIProviderAdapter",
    "AIProviderError",
    "AskResult",
    "ChatMessage",
    "ChatResult",
    "Citation",
    "ContextBudget",
    "EmbeddingResult",
    "ModelCapabilities",
    "PrivacyGate",
    "ProfileLimits",
    "RAGScope",
    "ValidatedProviderURL",
    "ask",
    "compute_budget",
    "get_adapter",
    "record_usage",
    "resolve_profile",
    "validate_provider_base_url",
]
