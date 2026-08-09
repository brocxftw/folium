"""Structure-aware document chunking."""

from __future__ import annotations

import re
from dataclasses import dataclass

try:
    import tiktoken

    _ENCODER = tiktoken.get_encoding("cl100k_base")
except Exception:  # pragma: no cover - optional dependency path
    _ENCODER = None

TARGET_MIN_TOKENS = 500
TARGET_MAX_TOKENS = 800
MAX_TOKENS = 1000
MIN_TOKENS = 150
OVERLAP_RATIO = 0.10

_HEADING_RE = re.compile(
    r"^(?:#{1,6}\s+.+|[A-Z0-9][A-Z0-9\s\-]{2,60}$|\d+(?:\.\d+)*[\.)]\s+.+)$"
)


@dataclass(frozen=True)
class PageInput:
    page_number: int
    text: str


@dataclass(frozen=True)
class ChunkDraft:
    page_number: int | None
    section: str | None
    text: str
    token_count: int
    chunk_index: int


def estimate_tokens(text: str) -> int:
    """Estimate token count using tiktoken when available."""
    stripped = text.strip()
    if not stripped:
        return 0
    if _ENCODER is not None:
        return len(_ENCODER.encode(stripped))
    words = len(stripped.split())
    return max(1, int(words * 1.3))


def chunk_pages(pages: list[PageInput | dict[str, object]]) -> list[ChunkDraft]:
    """Split extracted pages into structure-aware chunks."""
    normalized = [_coerce_page(page) for page in pages]
    blocks: list[_Block] = []
    for page in normalized:
        blocks.extend(_split_page_blocks(page.page_number, page.text))

    if not blocks:
        return []

    chunks: list[ChunkDraft] = []
    current: list[_Block] = []
    current_tokens = 0
    current_section: str | None = None
    chunk_index = 0

    def flush() -> None:
        nonlocal chunk_index, current, current_tokens, current_section
        if not current:
            return
        text = "\n\n".join(block.text for block in current).strip()
        if not text:
            current = []
            current_tokens = 0
            return
        chunks.append(
            ChunkDraft(
                page_number=current[0].page_number,
                section=current_section,
                text=text,
                token_count=estimate_tokens(text),
                chunk_index=chunk_index,
            )
        )
        chunk_index += 1
        overlap_blocks = _overlap_tail(current)
        current = overlap_blocks
        current_tokens = sum(block.tokens for block in current)

    for block in blocks:
        if block.is_heading:
            if current and current_tokens >= MIN_TOKENS:
                flush()
            current_section = block.text.strip("# ").strip()
            if current and current[-1].page_number != block.page_number:
                flush()

        prospective = current_tokens + block.tokens
        if current and prospective > MAX_TOKENS:
            flush()

        current.append(block)
        current_tokens += block.tokens

        if current_tokens >= TARGET_MAX_TOKENS:
            flush()
        elif current_tokens >= TARGET_MIN_TOKENS and block.is_heading:
            flush()

    if current:
        if chunks and current_tokens < MIN_TOKENS:
            merged_text = f"{chunks[-1].text}\n\n" + "\n\n".join(b.text for b in current)
            chunks[-1] = ChunkDraft(
                page_number=chunks[-1].page_number,
                section=chunks[-1].section or current_section,
                text=merged_text.strip(),
                token_count=estimate_tokens(merged_text),
                chunk_index=chunks[-1].chunk_index,
            )
        else:
            flush()

    return chunks


@dataclass
class _Block:
    page_number: int
    text: str
    tokens: int
    is_heading: bool = False


def _coerce_page(page: PageInput | dict[str, object]) -> PageInput:
    if isinstance(page, PageInput):
        return page
    page_number = int(page["page_number"])
    text = str(page["text"])
    return PageInput(page_number=page_number, text=text)


def _split_page_blocks(page_number: int, text: str) -> list[_Block]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if not paragraphs:
        return []
    blocks: list[_Block] = []
    for paragraph in paragraphs:
        lines = [line.strip() for line in paragraph.splitlines() if line.strip()]
        if not lines:
            continue
        if len(lines) == 1:
            is_heading = bool(_HEADING_RE.match(lines[0]))
            blocks.append(
                _Block(
                    page_number=page_number,
                    text=lines[0],
                    tokens=estimate_tokens(lines[0]),
                    is_heading=is_heading,
                )
            )
            continue
        for line in lines:
            is_heading = bool(_HEADING_RE.match(line))
            blocks.append(
                _Block(
                    page_number=page_number,
                    text=line,
                    tokens=estimate_tokens(line),
                    is_heading=is_heading,
                )
            )
    return blocks


def _overlap_tail(blocks: list[_Block]) -> list[_Block]:
    if not blocks:
        return []
    target = max(1, int(sum(block.tokens for block in blocks) * OVERLAP_RATIO))
    tail: list[_Block] = []
    running = 0
    for block in reversed(blocks):
        tail.insert(0, block)
        running += block.tokens
        if running >= target:
            break
    return tail
