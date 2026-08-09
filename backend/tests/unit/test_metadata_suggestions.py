"""Unit tests for AI metadata suggestion parsing and folder-path validation."""

from __future__ import annotations

import json

import pytest

from folium.workers.processor import (
    _FOLDER_PATH_RE,
    _is_system_folder_path,
    _normalize_folder_path,
    _parse_suggestion_json,
)


@pytest.mark.parametrize(
    ("raw", "expected_folder", "expected_tags"),
    [
        (
            json.dumps(
                {
                    "folder_path": "Finance / Insurance",
                    "create_folder": True,
                    "title": "LPPSA Refinance",
                    "tags": ["lppsa", "refinance", "housing"],
                    "needs_review": False,
                }
            ),
            "Finance / Insurance",
            ["lppsa", "refinance", "housing"],
        ),
        (
            'Here is the filing:\n```json\n{"folder_path":"Finance/Taxes","create_folder":true,'
            '"title":null,"tags":["tax"],"needs_review":false}\n```\n',
            "Finance/Taxes",
            ["tax"],
        ),
        (
            'noise before {"folder_path": "Legal / Contracts", "create_folder": true, '
            '"tags": ["contract"], "needs_review": true} trailing junk',
            "Legal / Contracts",
            ["contract"],
        ),
    ],
)
def test_parse_suggestion_json_extracts_folder_and_tags(
    raw: str,
    expected_folder: str,
    expected_tags: list[str],
) -> None:
    data = _parse_suggestion_json(raw)
    assert data.get("folder_path") == expected_folder
    assert data.get("tags") == expected_tags


def test_parse_suggestion_json_empty_on_garbage() -> None:
    assert _parse_suggestion_json("no json here") == {}
    assert _parse_suggestion_json("[]") == {}
    assert _parse_suggestion_json("") == {}


@pytest.mark.parametrize(
    "path",
    [
        "Finance",
        "Finance/Insurance",
        "Finance / Insurance",
        "Documents/2026/Taxes",
        "A & B's Notes",
        "Work.Archive",
    ],
)
def test_folder_path_regex_accepts_common_paths(path: str) -> None:
    normalized = path.replace(" / ", "/")
    assert _FOLDER_PATH_RE.match(normalized), f"rejected: {normalized!r}"


@pytest.mark.parametrize(
    "path",
    [
        "",
        "/leading",
        "bad;drop",
        "has\nnewline",
        "a" * 202,
    ],
)
def test_folder_path_regex_rejects_invalid(path: str) -> None:
    assert not _FOLDER_PATH_RE.match(path)


def test_parse_preserves_create_folder_and_needs_review() -> None:
    data = _parse_suggestion_json(
        '{"folder_path":"X","create_folder":true,"needs_review":true,"tags":[]}'
    )
    assert data["create_folder"] is True
    assert data["needs_review"] is True
    assert data["tags"] == []


@pytest.mark.parametrize(
    "path",
    [
        "Inbox",
        "Documents / Inbox",
        "documents/inbox",
        "Trash",
        "Documents / Trash",
        "Documents",
    ],
)
def test_system_folder_paths_rejected(path: str) -> None:
    assert _is_system_folder_path(_normalize_folder_path(path))


@pytest.mark.parametrize(
    "path",
    [
        "Identity / Aishah Binti Abdul Azim",
        "Birth Certificates / Malaysia",
        "Finance / Salary / 2025",
    ],
)
def test_filing_folder_paths_allowed(path: str) -> None:
    assert not _is_system_folder_path(path)
    assert _FOLDER_PATH_RE.match(path.replace(" / ", "/"))


def test_normalize_folder_path_collapses_slashes() -> None:
    assert _normalize_folder_path("Identity/Aishah") == "Identity / Aishah"
    assert _normalize_folder_path("  Finance /  Taxes  ") == "Finance / Taxes"
