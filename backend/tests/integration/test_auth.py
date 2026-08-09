"""Authentication integration tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import login


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient) -> None:
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "testpass"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["username"] == "admin"
    assert body["user"]["is_admin"] is True
    assert body["csrf_token"]
    assert client.cookies.get("folium_session")


@pytest.mark.asyncio
async def test_login_failure(client: AsyncClient) -> None:
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "auth_error"


@pytest.mark.asyncio
async def test_me_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_session(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/api/auth/me")
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["username"] == "admin"
    assert body["csrf_token"] == auth_client.headers["X-CSRF-Token"]


@pytest.mark.asyncio
async def test_logout_clears_session(auth_client: AsyncClient) -> None:
    logout = await auth_client.post("/api/auth/logout")
    assert logout.status_code == 200

    me = await auth_client.get("/api/auth/me")
    assert me.status_code == 401


@pytest.mark.asyncio
async def test_csrf_required_on_post(client: AsyncClient) -> None:
    await login(client)
    client.headers.pop("X-CSRF-Token", None)

    response = await client.post(
        "/api/folders",
        json={"name": "No CSRF Folder"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"
