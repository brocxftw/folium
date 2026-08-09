"""Tag management integration tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_tag(auth_client: AsyncClient) -> None:
    response = await auth_client.post(
        "/api/tags",
        json={"name": "LPPSA", "color": "#2563eb"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "LPPSA"
    assert body["slug"] == "lppsa"
    assert body["document_count"] == 0


@pytest.mark.asyncio
async def test_assign_tag_to_document(
    auth_client: AsyncClient,
    uploaded_txt_doc: dict,
) -> None:
    tag = await auth_client.post("/api/tags", json={"name": "Refinance"})
    tag_id = tag.json()["id"]
    doc_id = uploaded_txt_doc["id"]

    updated = await auth_client.patch(
        f"/api/documents/{doc_id}/metadata",
        json={"tag_ids": [tag_id]},
    )
    assert updated.status_code == 200
    assert len(updated.json()["tags"]) == 1
    assert updated.json()["tags"][0]["name"] == "Refinance"


@pytest.mark.asyncio
async def test_filter_documents_by_tag(
    auth_client: AsyncClient,
    uploaded_txt_doc: dict,
) -> None:
    tag = await auth_client.post("/api/tags", json={"name": "FilterMe"})
    tag_id = tag.json()["id"]
    doc_id = uploaded_txt_doc["id"]

    await auth_client.patch(
        f"/api/documents/{doc_id}/metadata",
        json={"tag_ids": [tag_id]},
    )

    listed = await auth_client.get("/api/documents", params={"tag_ids": [tag_id]})
    assert listed.status_code == 200
    ids = {item["id"] for item in listed.json()["items"]}
    assert doc_id in ids


@pytest.mark.asyncio
async def test_delete_tag(auth_client: AsyncClient) -> None:
    created = await auth_client.post("/api/tags", json={"name": "Temporary"})
    tag_id = created.json()["id"]

    deleted = await auth_client.delete(f"/api/tags/{tag_id}")
    assert deleted.status_code == 200

    listed = await auth_client.get("/api/tags")
    assert tag_id not in {t["id"] for t in listed.json()}
