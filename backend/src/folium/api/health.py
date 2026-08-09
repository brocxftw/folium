"""Health check endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from folium import __version__
from folium.api.schemas import HealthOut, StorageHealthOut
from folium.db.session import get_db
from folium.storage.service import StorageService

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    return HealthOut(status="ok", version=__version__)


@router.get("/health/database", response_model=HealthOut)
async def health_database(db: AsyncSession = Depends(get_db)) -> HealthOut:
    await db.execute(text("SELECT 1"))
    return HealthOut(status="ok", version=__version__)


@router.get("/health/storage", response_model=StorageHealthOut)
async def health_storage() -> StorageHealthOut:
    health = StorageService().check_health()
    return StorageHealthOut(
        status=health.status,
        documents_ok=health.documents_ok,
        consume_ok=health.consume_ok,
        export_ok=health.export_ok,
        documents_path=health.documents_path,
        consume_path=health.consume_path,
        export_path=health.export_path,
        message=health.message,
    )
