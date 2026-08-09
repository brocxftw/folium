import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_session_management_and_operational_endpoints(
    auth_client: AsyncClient,
) -> None:
    sessions = await auth_client.get("/api/auth/me/sessions")
    assert sessions.status_code == 200
    assert len(sessions.json()) == 1
    assert sessions.json()[0]["current"] is True

    for path in (
        "/api/system/summary",
        "/api/system/storage",
        "/api/system/diagnostics",
        "/api/logs",
        "/api/about",
    ):
        response = await auth_client.get(path)
        assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_workload_assignments_are_independent(auth_client: AsyncClient) -> None:
    provider = await auth_client.post(
        "/api/ai/providers",
        json={
            "name": "assignment-provider",
            "kind": "openai_compatible",
            "base_url": "http://localhost:9999/v1",
            "is_local": True,
            "chat_model": "legacy-chat",
            "embedding_model": "legacy-embedding",
            "supports_embeddings": True,
        },
    )
    assert provider.status_code == 201, provider.text
    provider_id = provider.json()["id"]

    indexing = await auth_client.patch(
        "/api/ai/assignments",
        json={"role": "indexing", "provider_id": provider_id, "model": "fast-index"},
    )
    chat = await auth_client.patch(
        "/api/ai/assignments",
        json={"role": "chat", "provider_id": provider_id, "model": "reasoning-chat"},
    )
    assert indexing.status_code == 200, indexing.text
    assert chat.status_code == 200, chat.text

    assignments = (await auth_client.get("/api/ai/assignments")).json()
    by_role = {item["role"]: item for item in assignments}
    assert by_role["indexing"]["model"] == "fast-index"
    assert by_role["chat"]["model"] == "reasoning-chat"
    assert by_role["embedding"]["model"] is None

    capabilities = await auth_client.get("/api/ai/capabilities")
    assert capabilities.status_code == 200
    assert capabilities.json()["chat_available"] is True


@pytest.mark.asyncio
async def test_logs_export_is_redacted_and_csv_safe(auth_client: AsyncClient) -> None:
    # Access logging writes asynchronously; the API contract must remain safe
    # even when there are no rows yet.
    response = await auth_client.get("/api/logs/export")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "authorization" not in response.text.lower()
