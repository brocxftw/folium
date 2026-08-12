"""Extractor routing tests for PaddleOCR (mocked)."""

from __future__ import annotations

from pathlib import Path

import pymupdf
import pytest

from folium.core.config import Settings
from folium.ocr import extractor
from folium.ocr.extractor import extract_document


def _settings(**kwargs: object) -> Settings:
    defaults = {
        "ocr_enabled": True,
        "ocr_language": "eng",
    }
    defaults.update(kwargs)
    return Settings.model_construct(**defaults)


def _make_blank_pdf(path: Path) -> None:
    doc = pymupdf.open()
    doc.new_page()
    doc.save(path)
    doc.close()


def _make_text_pdf(path: Path, text: str) -> None:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    doc.save(path)
    doc.close()


def test_pdf_force_ocr_uses_paddle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    pdf = tmp_path / "scan.pdf"
    _make_blank_pdf(pdf)

    monkeypatch.setattr(extractor, "paddle_ocr_available", lambda: True)

    def _fake_pages(path: Path, *, language: str):
        assert language == "eng"
        from folium.ocr.extractor import ExtractedPage

        return [ExtractedPage(page_number=1, text="Paddle text")]

    monkeypatch.setattr(extractor, "_ocr_pdf_pages_paddle", _fake_pages)

    result = extract_document(
        pdf,
        "application/pdf",
        settings=_settings(),
        force_ocr=True,
    )
    assert result.method == "pymupdf+paddleocr"
    assert result.pages[0].text == "Paddle text"


def test_pdf_ocr_reports_page_progress(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    pdf = tmp_path / "scan2.pdf"
    doc = pymupdf.open()
    doc.new_page()
    doc.new_page()
    doc.save(pdf)
    doc.close()

    monkeypatch.setattr(extractor, "paddle_ocr_available", lambda: True)
    monkeypatch.setattr(extractor, "ocr_image", lambda *_a, **_k: "line")

    seen: list[tuple[int, int]] = []
    result = extract_document(
        pdf,
        "application/pdf",
        settings=_settings(),
        force_ocr=True,
        on_ocr_progress=lambda done, total: seen.append((done, total)),
    )
    assert result.page_count == 2
    assert seen[0] == (0, 2)
    assert seen[-1] == (2, 2)
    assert (1, 2) in seen


def test_pdf_native_only_skips_paddle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    pdf = tmp_path / "native.pdf"
    _make_text_pdf(pdf, "This is enough native PDF text for the page threshold check.")

    called = {"ocr": False}

    def _boom(*_a, **_k):
        called["ocr"] = True
        raise AssertionError("OCR should not run for allow_ocr=False")

    monkeypatch.setattr(extractor, "_ocr_pdf_pages_paddle", _boom)

    result = extract_document(
        pdf,
        "application/pdf",
        settings=_settings(),
        allow_ocr=False,
    )
    assert result.method == "pymupdf"
    assert called["ocr"] is False


def test_image_uses_paddleocr_method(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    image = tmp_path / "shot.png"
    # Minimal valid-ish PNG header; Pillow may still open some tiny files — use RGB via pillow.
    from PIL import Image

    Image.new("RGB", (8, 8), color=(255, 255, 255)).save(image)

    monkeypatch.setattr(extractor, "paddle_ocr_available", lambda: True)
    monkeypatch.setattr(extractor, "ocr_image", lambda path, *, language=None: "Hello from paddle")

    seen: list[tuple[int, int]] = []
    result = extract_document(
        image,
        "image/png",
        settings=_settings(),
        on_ocr_progress=lambda done, total: seen.append((done, total)),
    )
    assert result.method == "paddleocr"
    assert result.pages[0].text == "Hello from paddle"
    assert seen == [(0, 1), (1, 1)]


def test_image_fallback_without_paddle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    image = tmp_path / "shot.png"
    from PIL import Image

    Image.new("RGB", (8, 8), color=(0, 0, 0)).save(image)

    monkeypatch.setattr(extractor, "paddle_ocr_available", lambda: False)

    result = extract_document(image, "image/png", settings=_settings())
    assert result.method == "pillow"
    assert "Image:" in result.pages[0].text
