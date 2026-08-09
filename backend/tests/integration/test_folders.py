"""Folder hierarchy integration tests."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_nested_folders(auth_client: AsyncClient) -> None:
    parent = await auth_client.post("/api/folders", json={"name": "Finance"})
    assert parent.status_code == 201
    parent_id = parent.json()["id"]

    child = await auth_client.post(
        "/api/folders",
        json={"name": "LPPSA", "parent_id": parent_id},
    )
    assert child.status_code == 201
    assert child.json()["parent_id"] == parent_id
    assert "Finance" in child.json()["path_cache"]


@pytest.mark.asyncio
async def test_rename_folder(auth_client: AsyncClient) -> None:
    created = await auth_client.post("/api/folders", json={"name": "Old Name"})
    folder_id = created.json()["id"]

    renamed = await auth_client.patch(
        f"/api/folders/{folder_id}",
        json={"name": "New Name"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_move_folder(auth_client: AsyncClient) -> None:
    a = await auth_client.post("/api/folders", json={"name": "Parent A"})
    b = await auth_client.post("/api/folders", json={"name": "Parent B"})
    child = await auth_client.post(
        "/api/folders",
        json={"name": "Movable", "parent_id": a.json()["id"]},
    )
    child_id = child.json()["id"]

    moved = await auth_client.patch(
        f"/api/folders/{child_id}",
        json={"parent_id": b.json()["id"]},
    )
    assert moved.status_code == 200
    assert moved.json()["parent_id"] == b.json()["id"]


@pytest.mark.asyncio
async def test_move_folder_cycle_rejected(auth_client: AsyncClient) -> None:
    parent = await auth_client.post("/api/folders", json={"name": "Cycle Parent"})
    child = await auth_client.post(
        "/api/folders",
        json={"name": "Cycle Child", "parent_id": parent.json()["id"]},
    )
    parent_id = parent.json()["id"]
    child_id = child.json()["id"]

    response = await auth_client.patch(
        f"/api/folders/{parent_id}",
        json={"parent_id": child_id},
    )
    assert response.status_code == 422
    assert "descendant" in response.json()["message"].lower() or "cycle" in response.json()["message"].lower()


@pytest.mark.asyncio
async def test_delete_folder_move_to_parent(auth_client: AsyncClient) -> None:
    parent = await auth_client.post("/api/folders", json={"name": "Delete Parent"})
    child = await auth_client.post(
        "/api/folders",
        json={"name": "Delete Child", "parent_id": parent.json()["id"]},
    )
    parent_id = parent.json()["id"]
    child_id = child.json()["id"]

    deleted = await auth_client.request(
        "DELETE",
        f"/api/folders/{child_id}",
        json={"strategy": "move_to_parent"},
    )
    assert deleted.status_code == 204

    folders = await auth_client.get("/api/folders")
    ids = {f["id"] for f in folders.json()}
    assert child_id not in ids
    assert parent_id in ids


@pytest.mark.asyncio
async def test_delete_folder_move_to_inbox(auth_client: AsyncClient) -> None:
    folder = await auth_client.post("/api/folders", json={"name": "Inbox Target"})
    folder_id = folder.json()["id"]

    deleted = await auth_client.request(
        "DELETE",
        f"/api/folders/{folder_id}",
        json={"strategy": "move_to_inbox"},
    )
    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_trash_folder_restore_and_purge(
    auth_client: AsyncClient,
    sample_txt_path,
) -> None:
    folder = await auth_client.post("/api/folders", json={"name": "Trash Me"})
    folder_id = folder.json()["id"]

    with sample_txt_path.open("rb") as fh:
        upload = await auth_client.post(
            "/api/documents/upload",
            files={"file": ("sample.txt", fh, "text/plain")},
            data={"folder_id": folder_id},
        )
    assert upload.status_code in {200, 201}
    body = upload.json()
    doc_id = body["id"] if "id" in body else body["document"]["id"]

    trashed = await auth_client.post(f"/api/folders/{folder_id}/trash")
    assert trashed.status_code == 200
    assert trashed.json()["is_trashed"] is True

    tree = await auth_client.get("/api/folders")
    assert folder_id not in {f["id"] for f in tree.json()}

    listed = await auth_client.get("/api/folders", params={"trashed": True})
    assert any(f["id"] == folder_id for f in listed.json())

    docs = await auth_client.get("/api/documents", params={"trashed": True})
    assert any(d["id"] == doc_id for d in docs.json()["items"])

    restored = await auth_client.post(f"/api/folders/{folder_id}/restore")
    assert restored.status_code == 200
    assert restored.json()["is_trashed"] is False

    active = await auth_client.get(f"/api/documents/{doc_id}")
    assert active.status_code == 200
    assert active.json()["is_trashed"] is False
    assert active.json()["folder_id"] == folder_id

    await auth_client.post(f"/api/folders/{folder_id}/trash")
    purged = await auth_client.post(f"/api/folders/{folder_id}/purge")
    assert purged.status_code == 200

    gone = await auth_client.get(f"/api/folders/{folder_id}")
    assert gone.status_code == 404
    gone_doc = await auth_client.get(f"/api/documents/{doc_id}")
    assert gone_doc.status_code == 404


@pytest.mark.asyncio
async def test_empty_trash(auth_client: AsyncClient, sample_txt_path) -> None:
    folder = await auth_client.post("/api/folders", json={"name": "Empty Trash Folder"})
    folder_id = folder.json()["id"]
    with sample_txt_path.open("rb") as fh:
        await auth_client.post(
            "/api/documents/upload",
            files={"file": ("empty-trash.txt", fh, "text/plain")},
            data={"folder_id": folder_id},
        )
    await auth_client.post(f"/api/folders/{folder_id}/trash")

    emptied = await auth_client.post("/api/trash/empty")
    assert emptied.status_code == 200

    count = await auth_client.get("/api/trash/count")
    assert count.status_code == 200
    assert count.json()["total"] == 0
