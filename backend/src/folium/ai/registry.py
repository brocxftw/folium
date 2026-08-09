"""AI provider adapter factory."""

from __future__ import annotations

from folium.ai.anthropic import AnthropicAdapter
from folium.ai.base import AIProviderAdapter
from folium.ai.gemini import GeminiAdapter
from folium.ai.openai_compatible import OpenAICompatibleAdapter
from folium.core.security import decrypt_secret
from folium.models import AIProvider, ProviderKind


def get_adapter(provider: AIProvider, api_key: str | None = None) -> AIProviderAdapter:
    """Return the adapter implementation for a configured provider."""
    resolved_key = api_key
    if resolved_key is None and provider.encrypted_api_key:
        resolved_key = decrypt_secret(provider.encrypted_api_key)

    match provider.kind:
        case (
            ProviderKind.OPENAI_COMPATIBLE
            | ProviderKind.OPENAI
            | ProviderKind.OPENROUTER
            | ProviderKind.OLLAMA
        ):
            return OpenAICompatibleAdapter(provider, resolved_key)
        case ProviderKind.ANTHROPIC:
            return AnthropicAdapter(provider, resolved_key)
        case ProviderKind.GEMINI:
            return GeminiAdapter(provider, resolved_key)
        case _:
            raise ValueError(f"Unsupported provider kind: {provider.kind}")
