"""API token and Bearer authentication."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import login


async def _create_token(client: AsyncClient, name: str = "mcp") -> dict:
    response = await client.post("/api/auth/tokens", json={"name": name})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.asyncio
async def test_create_token_secret_once(auth_client: AsyncClient) -> None:
    created = await _create_token(auth_client, "Cursor")
    assert created["name"] == "Cursor"
    assert created["token"].startswith("fol_")
    assert created["prefix"] == created["token"][:12]
    assert "token" in created

    listed = await auth_client.get("/api/auth/tokens")
    assert listed.status_code == 200
    rows = listed.json()
    assert len(rows) == 1
    assert rows[0]["id"] == created["id"]
    assert rows[0]["name"] == "Cursor"
    assert rows[0]["prefix"] == created["prefix"]
    assert "token" not in rows[0]


@pytest.mark.asyncio
async def test_create_token_requires_name(auth_client: AsyncClient) -> None:
    response = await auth_client.post("/api/auth/tokens", json={"name": "  "})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_bearer_me_and_cookie_me(auth_client: AsyncClient, client: AsyncClient) -> None:
    created = await _create_token(auth_client)
    token = created["token"]

    cookie_me = await auth_client.get("/api/auth/me")
    assert cookie_me.status_code == 200
    assert cookie_me.json()["user"]["username"] == "admin"
    assert cookie_me.json()["csrf_token"]

    bearer = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bearer.status_code == 200
    assert bearer.json()["user"]["username"] == "admin"
    assert bearer.json()["csrf_token"] == ""


@pytest.mark.asyncio
async def test_invalid_bearer_rejected(client: AsyncClient) -> None:
    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "auth_error"


@pytest.mark.asyncio
async def test_revoke_foreign_token_not_found(
    auth_client: AsyncClient, guest_client: AsyncClient
) -> None:
    await _create_token(auth_client, "admin-token")

    reg = await guest_client.post(
        "/api/auth/register",
        json={"username": "token_bob", "password": "password123", "display_name": "Bob"},
    )
    assert reg.status_code == 200, reg.text
    csrf = reg.json()["csrf_token"]
    bob_create = await guest_client.post(
        "/api/auth/tokens",
        json={"name": "bob-mcp"},
        headers={"X-CSRF-Token": csrf},
    )
    assert bob_create.status_code == 200, bob_create.text
    bob_id = bob_create.json()["id"]

    forbidden = await auth_client.delete(f"/api/auth/tokens/{bob_id}")
    assert forbidden.status_code == 404

    still = await guest_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {bob_create.json()['token']}"},
    )
    assert still.status_code == 200
    assert still.json()["user"]["username"] == "token_bob"


@pytest.mark.asyncio
async def test_inactive_user_token_rejected(
    auth_client: AsyncClient, guest_client: AsyncClient, client: AsyncClient
) -> None:
    reg = await guest_client.post(
        "/api/auth/register",
        json={"username": "token_inactive", "password": "password123", "display_name": "Inact"},
    )
    assert reg.status_code == 200
    csrf = reg.json()["csrf_token"]
    user_id = reg.json()["user"]["id"]
    created = await guest_client.post(
        "/api/auth/tokens",
        json={"name": "will-die"},
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 200
    token = created.json()["token"]

    disable = await auth_client.patch(f"/api/users/{user_id}", json={"is_active": False})
    assert disable.status_code == 200, disable.text

    rejected = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rejected.status_code == 401


@pytest.mark.asyncio
async def test_bearer_mutation_skips_csrf(auth_client: AsyncClient, client: AsyncClient) -> None:
    created = await _create_token(auth_client)
    token = created["token"]
    response = await client.post(
        "/api/folders",
        json={"name": "Bearer Folder"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["name"] == "Bearer Folder"


@pytest.mark.asyncio
async def test_cookie_mutation_still_requires_csrf(client: AsyncClient) -> None:
    await login(client)
    client.headers.pop("X-CSRF-Token", None)
    response = await client.post("/api/folders", json={"name": "No CSRF Folder"})
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


@pytest.mark.asyncio
async def test_revoke_token_rejects_bearer(auth_client: AsyncClient, client: AsyncClient) -> None:
    created = await _create_token(auth_client)
    token = created["token"]
    revoke = await auth_client.delete(f"/api/auth/tokens/{created['id']}")
    assert revoke.status_code == 200
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 401
