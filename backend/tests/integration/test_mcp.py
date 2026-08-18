"""MCP endpoint and read tools."""

from __future__ import annotations

import json
from typing import Any

import pytest
from httpx import AsyncClient, Response

# Streamable HTTP handshake era (Cursor / Claude Desktop today). Sending the
# 2026-07-28 "modern" version header without the _meta envelope is a 400.
_HANDSHAKE_VERSION = "2025-11-25"


def _mcp_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": _HANDSHAKE_VERSION,
    }


async def _mcp_rpc(
    client: AsyncClient,
    token: str,
    method: str,
    params: dict[str, Any] | None = None,
    rpc_id: int = 1,
) -> Response:
    return await client.post(
        "/mcp",
        headers=_mcp_headers(token),
        json={"jsonrpc": "2.0", "id": rpc_id, "method": method, "params": params or {}},
    )


def _rpc_result(response: Response) -> Any:
    assert response.status_code == 200, response.text
    body = response.json()
    assert "error" not in body, body
    return body["result"]


def _tool_payload(result: dict[str, Any]) -> Any:
    if result.get("structuredContent") is not None:
        return result["structuredContent"]
    content = result.get("content") or []
    if content and content[0].get("text"):
        text = content[0]["text"]
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text
    return result


async def _admin_token(auth_client: AsyncClient) -> str:
    response = await auth_client.post("/api/auth/tokens", json={"name": "mcp-tests"})
    assert response.status_code == 200, response.text
    return response.json()["token"]


@pytest.mark.asyncio
async def test_mcp_requires_bearer(auth_client: AsyncClient, client: AsyncClient) -> None:
    missing = await client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "initialize"})
    assert missing.status_code == 401

    cookie_only = await auth_client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize"},
    )
    assert cookie_only.status_code == 401


@pytest.mark.asyncio
async def test_mcp_initialize_and_tools_list(auth_client: AsyncClient, client: AsyncClient) -> None:
    token = await _admin_token(auth_client)
    init = await _mcp_rpc(
        client,
        token,
        "initialize",
        {
            "protocolVersion": _HANDSHAKE_VERSION,
            "capabilities": {},
            "clientInfo": {"name": "folium-tests", "version": "0.0.1"},
        },
    )
    result = _rpc_result(init)
    assert result.get("protocolVersion")

    listed = await _mcp_rpc(client, token, "tools/list")
    tools = _rpc_result(listed)["tools"]
    names = sorted(t["name"] for t in tools)
    assert names == ["get_document", "list_folder", "search_documents", "search_evidence"]


@pytest.mark.asyncio
async def test_mcp_tools_search_get_list(
    auth_client: AsyncClient,
    client: AsyncClient,
    uploaded_txt_doc: dict,
) -> None:
    token = await _admin_token(auth_client)
    doc_id = uploaded_txt_doc["id"]

    empty = await _mcp_rpc(
        client,
        token,
        "tools/call",
        {"name": "search_evidence", "arguments": {"query": ""}},
    )
    body = empty.json()
    assert empty.status_code == 200
    assert body.get("result", {}).get("isError") is True or "error" in body

    evidence = await _mcp_rpc(
        client,
        token,
        "tools/call",
        {
            "name": "search_evidence",
            "arguments": {"query": "LPPSA refinance", "mode": "keyword"},
        },
    )
    payload = _tool_payload(_rpc_result(evidence))
    assert any(item["document_id"] == doc_id for item in payload["items"])
    hit = next(item for item in payload["items"] if item["document_id"] == doc_id)
    assert hit.get("text") or hit.get("score") is not None

    documents = await _mcp_rpc(
        client,
        token,
        "tools/call",
        {
            "name": "search_documents",
            "arguments": {"query": "LPPSA refinance", "mode": "keyword"},
        },
    )
    docs_payload = _tool_payload(_rpc_result(documents))
    assert any(item["id"] == doc_id for item in docs_payload["items"])

    got = await _mcp_rpc(
        client,
        token,
        "tools/call",
        {"name": "get_document", "arguments": {"document_id": doc_id}},
    )
    got_payload = _tool_payload(_rpc_result(got))
    assert got_payload["document"]["id"] == doc_id
    assert got_payload["text_available"] is True
    assert got_payload["pages"]
    assert got_payload["truncated"] is False

    missing = await _mcp_rpc(
        client,
        token,
        "tools/call",
        {
            "name": "get_document",
            "arguments": {"document_id": "00000000-0000-0000-0000-000000000000"},
        },
    )
    missing_body = missing.json()
    assert missing.status_code == 200
    assert missing_body.get("result", {}).get("isError") is True or "error" in missing_body

    tree = await _mcp_rpc(client, token, "tools/call", {"name": "list_folder", "arguments": {}})
    tree_payload = _tool_payload(_rpc_result(tree))
    assert tree_payload["folders"]
    inbox = next(f for f in tree_payload["folders"] if f["kind"] == "inbox")
    one = await _mcp_rpc(
        client,
        token,
        "tools/call",
        {"name": "list_folder", "arguments": {"folder_id": inbox["id"], "recursive": False}},
    )
    one_payload = _tool_payload(_rpc_result(one))
    assert one_payload["folder"]["id"] == inbox["id"]
    assert any(d["id"] == doc_id for d in one_payload["documents"])


@pytest.mark.asyncio
async def test_mcp_owner_isolation(
    auth_client: AsyncClient,
    client: AsyncClient,
    guest_client: AsyncClient,
    uploaded_txt_doc: dict,
) -> None:
    doc_id = uploaded_txt_doc["id"]
    reg = await guest_client.post(
        "/api/auth/register",
        json={"username": "mcp_bob", "password": "password123", "display_name": "Bob"},
    )
    assert reg.status_code == 200
    csrf = reg.json()["csrf_token"]
    bob_token = await guest_client.post(
        "/api/auth/tokens",
        json={"name": "bob"},
        headers={"X-CSRF-Token": csrf},
    )
    token = bob_token.json()["token"]

    got = await _mcp_rpc(
        client,
        token,
        "tools/call",
        {"name": "get_document", "arguments": {"document_id": doc_id}},
    )
    body = got.json()
    assert got.status_code == 200
    assert body.get("result", {}).get("isError") is True or "error" in body
