"""App version resolution."""

from __future__ import annotations

from folium.core.version import get_app_version, normalize_version


def test_normalize_version_strips_release_prefix() -> None:
    assert normalize_version("  v0.1.16  ") == "0.1.16"
    assert normalize_version("V1.2.3") == "1.2.3"
    assert normalize_version("0.1.16") == "0.1.16"
    assert normalize_version("vnext") == "vnext"


def test_get_app_version_prefers_env(monkeypatch) -> None:
    from folium.core import version as version_mod

    get_app_version.cache_clear()
    monkeypatch.setenv("FOLIUM_VERSION", "v2.3.4")
    monkeypatch.setattr(version_mod, "_git_describe", lambda _cwd: "should-not-use")
    assert get_app_version() == "2.3.4"
    get_app_version.cache_clear()
