"""FRONTEND_ORIGIN parsing and secure-cookie policy."""

from __future__ import annotations

import os

import pytest

from folium.core.config import Settings


def test_frontend_origins_comma_separated() -> None:
    settings = Settings(FRONTEND_ORIGIN="https://a.example.com,http://192.168.1.1:9398")
    assert settings.frontend_origins == [
        "https://a.example.com",
        "http://192.168.1.1:9398",
    ]
    assert settings.primary_frontend_origin == "https://a.example.com"


def test_frontend_origins_dedupes() -> None:
    settings = Settings(
        FRONTEND_ORIGIN="https://a.example.com/,https://a.example.com,http://localhost:9398"
    )
    assert settings.frontend_origins == ["https://a.example.com", "http://localhost:9398"]


def test_use_secure_cookies_https_origin() -> None:
    settings = Settings(
        FOLIUM_ENV="production",
        FRONTEND_ORIGIN="https://folium.example.com,http://192.168.1.1:9398",
    )
    assert settings.use_secure_cookies is True


def test_use_secure_cookies_http_only() -> None:
    settings = Settings(FOLIUM_ENV="production", FRONTEND_ORIGIN="http://192.168.1.1:9398")
    assert settings.use_secure_cookies is False


def test_use_secure_cookies_explicit_override() -> None:
    settings = Settings(
        FOLIUM_ENV="production",
        FRONTEND_ORIGIN="http://192.168.1.1:9398",
        FOLIUM_SECURE_COOKIES=True,
    )
    assert settings.use_secure_cookies is True


def test_use_secure_cookies_dev() -> None:
    settings = Settings(
        FOLIUM_ENV="development",
        FRONTEND_ORIGIN="https://folium.example.com",
        FOLIUM_SECURE_COOKIES=True,
    )
    assert settings.use_secure_cookies is False


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    from folium.core.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_settings_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://a.test,http://b.test")
    monkeypatch.setenv("FOLIUM_ENV", "production")
    settings = Settings()
    assert settings.frontend_origins == ["https://a.test", "http://b.test"]
