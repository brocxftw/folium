"""Core health endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_liveness_does_not_include_worker_or_ai(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert "worker" not in body


@pytest.mark.asyncio
async def test_worker_health_unavailable_without_heartbeat(client: AsyncClient) -> None:
    response = await client.get("/health/worker")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
