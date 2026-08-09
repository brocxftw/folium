"""Folium application settings."""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class PrivacyMode(StrEnum):
    LOCAL_ONLY = "local_only"
    PRIVATE_HYBRID = "private_hybrid"
    STANDARD = "standard"


class AIProfile(StrEnum):
    LIGHTWEIGHT = "lightweight"
    BALANCED = "balanced"
    QUALITY = "quality"
    CUSTOM = "custom"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        # Explicit environment variables always win over env files.
    )

    secret_key: str = Field(default="dev-secret-change-me", alias="FOLIUM_SECRET_KEY")
    encryption_key: str = Field(
        default="dev-encryption-key-change-me", alias="FOLIUM_ENCRYPTION_KEY"
    )
    env: str = Field(default="development", alias="FOLIUM_ENV")
    log_level: str = Field(default="INFO", alias="FOLIUM_LOG_LEVEL")
    host: str = Field(default="0.0.0.0", alias="FOLIUM_HOST")
    port: int = Field(default=8000, alias="FOLIUM_PORT")

    admin_username: str = Field(default="admin", alias="FOLIUM_ADMIN_USERNAME")
    admin_password: str = Field(default="changeme", alias="FOLIUM_ADMIN_PASSWORD")
    allow_registration: bool = Field(default=True, alias="ALLOW_REGISTRATION")
    default_storage_quota_bytes: int | None = Field(
        default=None, alias="DEFAULT_STORAGE_QUOTA_BYTES"
    )
    default_ai_monthly_request_quota: int | None = Field(
        default=None, alias="DEFAULT_AI_MONTHLY_REQUEST_QUOTA"
    )

    database_url: str = Field(
        default="postgresql+asyncpg://folium:folium@localhost:5433/folium",
        alias="DATABASE_URL",
    )
    database_url_sync: str = Field(
        default="postgresql+psycopg://folium:folium@localhost:5433/folium",
        alias="DATABASE_URL_SYNC",
    )

    documents_path: Path = Field(default=Path("/documents"), alias="DOCUMENTS_PATH")
    consume_path: Path = Field(default=Path("/consume"), alias="CONSUME_PATH")
    export_path: Path = Field(default=Path("/export"), alias="EXPORT_PATH")

    max_upload_size_mb: int = Field(default=100, alias="MAX_UPLOAD_SIZE_MB")
    allowed_mime_types: str = Field(
        default=(
            "application/pdf,image/png,image/jpeg,text/plain,text/markdown,"
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        alias="ALLOWED_MIME_TYPES",
    )

    ocr_language: str = Field(default="eng", alias="OCR_LANGUAGE")
    ocr_enabled: bool = Field(default=True, alias="OCR_ENABLED")

    job_concurrency: int = Field(default=2, alias="JOB_CONCURRENCY")
    consume_poll_interval_seconds: float = Field(
        default=5.0, alias="CONSUME_POLL_INTERVAL_SECONDS"
    )
    job_poll_interval_seconds: float = Field(default=2.0, alias="JOB_POLL_INTERVAL_SECONDS")
    trash_retention_days: int = Field(default=30, alias="TRASH_RETENTION_DAYS")
    trash_purge_interval_seconds: float = Field(
        default=3600.0, alias="TRASH_PURGE_INTERVAL_SECONDS"
    )

    ai_privacy_mode: PrivacyMode = Field(
        default=PrivacyMode.LOCAL_ONLY, alias="AI_PRIVACY_MODE"
    )
    ai_profile: AIProfile = Field(default=AIProfile.LIGHTWEIGHT, alias="AI_PROFILE")
    ai_allow_remote_embeddings: bool = Field(
        default=False, alias="AI_ALLOW_REMOTE_EMBEDDINGS"
    )
    ai_allow_remote_qa: bool = Field(default=False, alias="AI_ALLOW_REMOTE_QA")
    ai_allow_remote_vision: bool = Field(default=False, alias="AI_ALLOW_REMOTE_VISION")
    ai_warn_before_remote: bool = Field(default=True, alias="AI_WARN_BEFORE_REMOTE")

    session_cookie_name: str = Field(default="folium_session", alias="SESSION_COOKIE_NAME")
    session_ttl_hours: int = Field(default=168, alias="SESSION_TTL_HOURS")
    csrf_cookie_name: str = Field(default="folium_csrf", alias="CSRF_COOKIE_NAME")
    frontend_origin: str = Field(default="http://localhost:8080", alias="FRONTEND_ORIGIN")

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def allowed_mimes(self) -> set[str]:
        return {m.strip() for m in self.allowed_mime_types.split(",") if m.strip()}

    @property
    def is_dev(self) -> bool:
        return self.env.lower() in {"development", "dev", "test"}

    @property
    def originals_path(self) -> Path:
        return self.documents_path / "originals"

    @property
    def previews_path(self) -> Path:
        return self.documents_path / "previews"

    @property
    def thumbnails_path(self) -> Path:
        return self.documents_path / "thumbnails"

    @field_validator("ai_privacy_mode", mode="before")
    @classmethod
    def _normalize_privacy(cls, value: object) -> object:
        if isinstance(value, str):
            return value.lower().replace("-", "_").replace(" ", "_")
        return value

    @field_validator("ai_profile", mode="before")
    @classmethod
    def _normalize_profile(cls, value: object) -> object:
        if isinstance(value, str):
            return value.lower()
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
