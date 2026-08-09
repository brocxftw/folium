"""Search integration tests."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_keyword_search_after_extraction(
    auth_client: AsyncClient,
    uploaded_txt_doc: dict,
) -> None:
    response = await auth_client.post(
        "/api/search",
        json={"query": "LPPSA refinance", "mode": "keyword"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert any("LPPSA" in (hit.get("snippet") or hit["document"]["title"]) for hit in body["items"])


@pytest.mark.asyncio
async def test_folder_scoped_search(
    auth_client: AsyncClient,
    uploaded_txt_doc: dict,
    sample_txt_path,
    run_extraction,
) -> None:
    folder = await auth_client.post("/api/folders", json={"name": "Search Scope"})
    folder_id = folder.json()["id"]

    scoped_content = b"Scoped folder document about LPPSA tenure 30 years RM 500000.\n"
    with sample_txt_path.open("rb") as _:
        pass
    scoped_path = sample_txt_path.parent / "scoped-sample.txt"
    scoped_path.write_bytes(scoped_content)

    with scoped_path.open("rb") as fh:
        scoped = await auth_client.post(
            "/api/documents/upload",
            files={"file": ("scoped.txt", fh, "text/plain")},
            params={"folder_id": folder_id},
        )
    assert scoped.status_code == 201
    await run_extraction(uuid.UUID(scoped.json()["id"]))

    in_folder = await auth_client.post(
        "/api/search",
        json={
            "query": "LPPSA",
            "mode": "keyword",
            "folder_id": folder_id,
            "include_descendants": False,
        },
    )
    assert in_folder.status_code == 200
    ids = {hit["document"]["id"] for hit in in_folder.json()["items"]}
    assert scoped.json()["id"] in ids
    assert uploaded_txt_doc["id"] not in ids
