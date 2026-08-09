"""Multi-user registration and ownership isolation."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_creates_private_library(auth_client: AsyncClient, client: AsyncClient) -> None:
    # auth_client is admin
    admin_folders = await auth_client.get("/api/folders")
    assert admin_folders.status_code == 200
    admin_ids = {f["id"] for f in admin_folders.json()}

    reg = await client.post(
        "/api/auth/register",
        json={
            "username": "bob_user",
            "password": "password123",
            "display_name": "Bob",
        },
    )
    assert reg.status_code == 200, reg.text
    assert reg.json()["user"]["is_admin"] is False

    # client now has bob's session cookies from register
    bob_folders = await client.get("/api/folders")
    assert bob_folders.status_code == 200
    kinds = {f["kind"] for f in bob_folders.json()}
    assert kinds == {"root", "inbox", "trash"}
    bob_ids = {f["id"] for f in bob_folders.json()}
    assert admin_ids.isdisjoint(bob_ids)

    bob_docs = await client.get("/api/documents")
    assert bob_docs.status_code == 200
    assert bob_docs.json()["total"] == 0

    ai = await client.get("/api/ai/providers")
    assert ai.status_code == 403


@pytest.mark.asyncio
async def test_registration_status(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/registration-status")
    assert resp.status_code == 200
    assert "allow_registration" in resp.json()
