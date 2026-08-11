"""Unit tests for AI metadata suggestion parsing and folder-path validation."""

from __future__ import annotations

import json

import pytest

from folium.workers.processor import (
    _FOLDER_PATH_RE,
    _coerce_confidence,
    _field_confidence,
    _is_system_folder_path,
    _normalize_folder_path,
    _parse_suggestion_json,
    _parse_tag_entries,
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


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, None),
        (True, None),
        ("", None),
        ("nope", None),
        (-0.1, None),
        (1.1, None),
        (0, 0.0),
        (1, 1.0),
        (0.85, 0.85),
        ("0.42", 0.42),
        (85, 0.85),
        ("90", 0.9),
        (95, 0.95),
    ],
)
def test_coerce_confidence(raw: object, expected: float | None) -> None:
    assert _coerce_confidence(raw) == expected


def test_field_confidence_reads_nested_object() -> None:
    data = {"confidence": {"folder": 0.91, "title": "80", "tags": 0.5}}
    assert _field_confidence(data, "folder") == 0.91
    assert _field_confidence(data, "title") == 0.8
    assert _field_confidence(data, "correspondent") is None


def test_parse_tag_entries_strings_and_objects() -> None:
    entries = _parse_tag_entries(
        [
            "lppsa",
            {"name": "Refinance", "confidence": 0.88},
            {"name": "lppsa", "confidence": 0.1},  # duplicate case
            {"name": "  ", "confidence": 0.9},
            {"confidence": 0.7},
            {"name": "housing-loan", "confidence": 95},
        ]
    )
    assert entries == [
        ("lppsa", None),
        ("Refinance", 0.88),
        ("housing-loan", 0.95),
    ]


def test_parse_tag_entries_caps_at_twelve() -> None:
    entries = _parse_tag_entries([f"t{i}" for i in range(20)])
    assert len(entries) == 12
    assert entries[0] == ("t0", None)
    assert entries[-1] == ("t11", None)
