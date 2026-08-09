"""AI provider secret handling integration tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_provider_api_key_masked_and_never_returned_plaintext(
    auth_client: AsyncClient,
) -> None:
    secret = "sk-test-secret-key-12345678"
    created = await auth_client.post(
        "/api/ai/providers",
        json={
            "name": "secret-provider",
            "kind": "openai_compatible",
            "base_url": "http://localhost:9999/v1",
            "api_key": secret,
            "is_local": True,
            "chat_model": "gpt-test",
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["has_api_key"] is True
    assert body["api_key_masked"] is not None
    assert secret not in (body["api_key_masked"] or "")
    assert body["api_key_masked"].endswith("5678")
    assert "api_key" not in body

    provider_id = body["id"]
    fetched = await auth_client.get(f"/api/ai/providers/{provider_id}")
    assert fetched.status_code == 200
    fetched_body = fetched.json()
    assert secret not in str(fetched_body)
    assert fetched_body["has_api_key"] is True
    assert fetched_body["api_key_masked"] is not None

    updated = await auth_client.patch(
        f"/api/ai/providers/{provider_id}",
        json={"chat_model": "gpt-test-2"},
    )
    assert updated.status_code == 200
    assert secret not in str(updated.json())
    assert updated.json()["has_api_key"] is True
