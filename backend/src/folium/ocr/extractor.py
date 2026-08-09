"""Local text extraction without LLMs."""

from __future__ import annotations

import logging
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pymupdf
from docx import Document as DocxDocument
from PIL import Image

from folium.core.config import Settings, get_settings
from folium.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

_MIN_CHARS_PER_PAGE = 32
_OCR_DPI = 200


@dataclass(frozen=True)
class ExtractedPage:
    page_number: int
    text: str


@dataclass
class ExtractedDocument:
    pages: list[ExtractedPage] = field(default_factory=list)
    page_count: int = 0
    language: str | None = None
    method: str = "unknown"

    def to_page_dicts(self) -> list[dict[str, Any]]:
        return [{"page_number": p.page_number, "text": p.text} for p in self.pages]


def extract_document(
    path: Path,
    mime_type: str,
    *,
    settings: Settings | None = None,
    language: str | None = None,
) -> ExtractedDocument:
    """Extract text from a supported document on disk."""
    settings = settings or get_settings()
    lang = language or settings.ocr_language
    path = path.resolve()
    if not path.is_file():
        raise ValidationError(f"File not found: {path}")

    mime = mime_type.lower()
    if mime == "application/pdf":
        return _extract_pdf(path, settings=settings, language=lang)
    if mime in {"image/png", "image/jpeg"}:
        return _extract_image(path, settings=settings, language=lang)
    if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _extract_docx(path)
    if mime in {"text/plain", "text/markdown"}:
        return _extract_text_file(path)
    raise ValidationError(f"Unsupported MIME type for extraction: {mime_type}")


def _extract_text_file(path: Path) -> ExtractedDocument:
    text = path.read_text(encoding="utf-8")
    pages = _split_text_pages(text)
    return ExtractedDocument(
        pages=pages,
        page_count=len(pages),
        language=None,
        method="utf8",
    )


def _split_text_pages(text: str) -> list[ExtractedPage]:
    if "\f" in text:
        parts = text.split("\f")
    else:
        parts = [text]
    return [
        ExtractedPage(page_number=index + 1, text=part.strip())
        for index, part in enumerate(parts)
        if part.strip()
    ] or [ExtractedPage(page_number=1, text="")]


def _extract_docx(path: Path) -> ExtractedDocument:
    doc = DocxDocument(str(path))
    paragraphs: list[str] = []
    for para in doc.paragraphs:
        line = para.text.strip()
        if line:
            paragraphs.append(line)
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                paragraphs.append(" | ".join(cells))
    text = "\n\n".join(paragraphs)
    return ExtractedDocument(
        pages=[ExtractedPage(page_number=1, text=text)],
        page_count=1,
        language=None,
        method="docx",
    )


def _extract_pdf(path: Path, *, settings: Settings, language: str) -> ExtractedDocument:
    pages = _pdf_text_pages(path)
    if _needs_ocr(pages) and settings.ocr_enabled:
        ocr_path: Path | None = None
        try:
            if _has_ocrmypdf():
                try:
                    ocr_path = _ocr_pdf_ocrmypdf(path, language=language)
                    pages = _pdf_text_pages(ocr_path)
                    method = "pymupdf+ocrmypdf"
                except ValidationError:
                    logger.info("OCRmyPDF unavailable for %s; trying tesseract", path)
                    if _has_tesseract():
                        pages = _ocr_pdf_pages_tesseract(path, language=language)
                        method = "pymupdf+tesseract"
                    else:
                        method = "pymupdf"
            elif _has_tesseract():
                pages = _ocr_pdf_pages_tesseract(path, language=language)
                method = "pymupdf+tesseract"
            else:
                logger.warning("OCR needed for %s but no OCR backend is available", path)
                method = "pymupdf"
        finally:
            if ocr_path is not None:
                ocr_path.unlink(missing_ok=True)
    else:
        method = "pymupdf"

    return ExtractedDocument(
        pages=pages,
        page_count=len(pages),
        language=language if method != "pymupdf" else None,
        method=method,
    )


def _pdf_text_pages(path: Path) -> list[ExtractedPage]:
    pages: list[ExtractedPage] = []
    with pymupdf.open(path) as doc:
        for index in range(doc.page_count):
            page = doc.load_page(index)
            text = page.get_text("text").strip()
            pages.append(ExtractedPage(page_number=index + 1, text=text))
    return pages


def _needs_ocr(pages: list[ExtractedPage]) -> bool:
    if not pages:
        return True
    non_empty = [p for p in pages if p.text.strip()]
    if not non_empty:
        return True
    avg_chars = sum(len(p.text) for p in non_empty) / len(non_empty)
    return avg_chars < _MIN_CHARS_PER_PAGE


def _extract_image(path: Path, *, settings: Settings, language: str) -> ExtractedDocument:
    text = ""
    method = "pillow"
    if settings.ocr_enabled and _has_tesseract():
        text = _ocr_image_path(path, language=language)
        method = "tesseract"
    else:
        with Image.open(path) as img:
            # Metadata-only fallback when OCR is unavailable.
            parts = [f"Image: {path.name}", f"Size: {img.size[0]}x{img.size[1]}", f"Mode: {img.mode}"]
            text = "\n".join(parts)
            if not settings.ocr_enabled:
                logger.info("OCR disabled; returning image metadata for %s", path)

    return ExtractedDocument(
        pages=[ExtractedPage(page_number=1, text=text.strip())],
        page_count=1,
        language=language if method == "tesseract" else None,
        method=method,
    )


def _ocr_image_path(path: Path, *, language: str) -> str:
    try:
        import pytesseract
    except ImportError:
        return _ocr_image_subprocess(path, language=language)

    with Image.open(path) as img:
        if img.mode not in {"RGB", "L"}:
            img = img.convert("RGB")
        return pytesseract.image_to_string(img, lang=language).strip()


def _ocr_image_subprocess(path: Path, *, language: str) -> str:
    tesseract = shutil.which("tesseract")
    if not tesseract:
        return ""
    result = subprocess.run(
        [tesseract, str(path), "stdout", "-l", language, "--psm", "3"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        logger.warning("tesseract failed for %s: %s", path, result.stderr.strip())
        return ""
    return result.stdout.strip()


def _ocr_pdf_pages_tesseract(path: Path, *, language: str) -> list[ExtractedPage]:
    pages: list[ExtractedPage] = []
    with pymupdf.open(path) as doc:
        for index in range(doc.page_count):
            page = doc.load_page(index)
            pix = page.get_pixmap(dpi=_OCR_DPI, alpha=False)
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            try:
                pix.save(str(tmp_path))
                text = _ocr_image_path(tmp_path, language=language)
            finally:
                tmp_path.unlink(missing_ok=True)
            pages.append(ExtractedPage(page_number=index + 1, text=text))
    return pages


def _has_tesseract() -> bool:
    return shutil.which("tesseract") is not None


def _has_ocrmypdf() -> bool:
    return shutil.which("ocrmypdf") is not None


def _ocr_pdf_ocrmypdf(path: Path, *, language: str) -> Path:
    fd, tmp_name = tempfile.mkstemp(suffix=".pdf")
    Path(tmp_name).unlink(missing_ok=True)
    output = Path(tmp_name)
    cmd = [
        "ocrmypdf",
        "--skip-text",
        "--optimize",
        "0",
        "-l",
        language,
        str(path),
        str(output),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        logger.warning("ocrmypdf failed for %s: %s", path, result.stderr.strip())
        raise ValidationError("OCRmyPDF failed to process scanned PDF")
    return output


def detect_language_hint(text: str) -> str | None:
    """Return a coarse language hint from extracted text."""
    sample = text[:4000]
    if not sample.strip():
        return None
    if re.search(r"[\u0400-\u04FF]", sample):
        return "rus"
    if re.search(r"[\u4E00-\u9FFF]", sample):
        return "chi_sim"
    if re.search(r"[\u0600-\u06FF]", sample):
        return "ara"
    return "eng"
