"""Document chunking unit tests."""

from __future__ import annotations

from folium.services.chunking import (
    MAX_TOKENS,
    MIN_TOKENS,
    TARGET_MAX_TOKENS,
    TARGET_MIN_TOKENS,
    PageInput,
    chunk_pages,
    estimate_tokens,
)


def test_chunk_sizes_respect_bounds() -> None:
    paragraphs = []
    for i in range(40):
        paragraphs.append(
            f"Section {i}\n\n"
            + ("Word " * 120)
            + f"\n\nLPPSA refinance detail paragraph {i} with RM 420000 tenure 25 years."
        )
    long_text = "\n\n".join(paragraphs)
    pages = [PageInput(page_number=1, text=long_text)]

    chunks = chunk_pages(pages)
    assert len(chunks) > 1

    for chunk in chunks:
        assert chunk.token_count <= MAX_TOKENS + 50
        assert chunk.text.strip()

    token_counts = [c.token_count for c in chunks]
    mid_chunks = token_counts[1:-1] if len(token_counts) > 2 else token_counts
    assert any(count >= MIN_TOKENS for count in mid_chunks) or len(chunks) == 1
    assert any(count <= TARGET_MAX_TOKENS + 100 for count in token_counts)


def test_empty_pages_produce_no_chunks() -> None:
    assert chunk_pages([PageInput(page_number=1, text="   ")]) == []


def test_estimate_tokens_nonzero_for_text() -> None:
    assert estimate_tokens("hello world") >= 1
