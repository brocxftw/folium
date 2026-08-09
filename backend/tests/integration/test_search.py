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
    assert body["document_total"] >= 1
    assert body["match_total"] >= 1
    assert any("LPPSA" in (hit.get("snippet") or hit["document"]["title"]) for hit in body["items"])
    hit = next(h for h in body["items"] if h["document"]["id"] == uploaded_txt_doc["id"])
    assert isinstance(hit.get("matches"), list)
    assert len(hit["matches"]) >= 1


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
            data={"folder_id": folder_id},
            files={"file": ("scoped.txt", fh, "text/plain")},
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


@pytest.mark.asyncio
async def test_search_tag_filter_and_coverage_fields(
    auth_client: AsyncClient,
    uploaded_txt_doc: dict,
) -> None:
    tag = await auth_client.post("/api/tags", json={"name": f"search-tag-{uuid.uuid4().hex[:8]}"})
    assert tag.status_code == 201
    tag_id = tag.json()["id"]

    patched = await auth_client.patch(
        f"/api/documents/{uploaded_txt_doc['id']}/metadata",
        json={"tag_ids": [tag_id]},
    )
    assert patched.status_code == 200

    with_tag = await auth_client.post(
        "/api/search",
        json={"query": "LPPSA", "mode": "keyword", "tag_ids": [tag_id]},
    )
    assert with_tag.status_code == 200
    body = with_tag.json()
    assert body["document_total"] >= 1
    assert "semantic_available" in body
    assert body.get("semantic_coverage") is not None
    assert uploaded_txt_doc["id"] in {h["document"]["id"] for h in body["items"]}

    other_tag = await auth_client.post(
        "/api/tags", json={"name": f"other-tag-{uuid.uuid4().hex[:8]}"}
    )
    assert other_tag.status_code == 201
    empty = await auth_client.post(
        "/api/search",
        json={
            "query": "LPPSA",
            "mode": "keyword",
            "tag_ids": [other_tag.json()["id"]],
        },
    )
    assert empty.status_code == 200
    assert empty.json()["document_total"] == 0
    assert empty.json()["items"] == []
