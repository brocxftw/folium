"""Health check endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from folium import __version__
from folium.api.schemas import HealthOut, StorageHealthOut, WorkerHealthOut
from folium.db.session import get_db
from folium.models import AppSetting
from folium.storage.service import StorageService
from folium.workers.healthcheck import (
    WORKER_HEARTBEAT_KEY,
    heartbeat_is_fresh,
    parse_heartbeat_at,
)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    return HealthOut(status="ok", version=__version__)


@router.get("/health/database", response_model=HealthOut)
async def health_database(db: AsyncSession = Depends(get_db)) -> HealthOut:
    await db.execute(text("SELECT 1"))
    return HealthOut(status="ok", version=__version__)


@router.get("/health/worker", response_model=WorkerHealthOut)
async def health_worker(db: AsyncSession = Depends(get_db)) -> WorkerHealthOut:
    heartbeat = await db.get(AppSetting, WORKER_HEARTBEAT_KEY)
    value = heartbeat.value if heartbeat is not None else None
    last_seen = parse_heartbeat_at(value)
    worker_id = None
    if isinstance(value, dict):
        raw_id = value.get("worker_id")
        worker_id = str(raw_id) if raw_id else None
    status = "healthy" if heartbeat_is_fresh(last_seen) else "unavailable"
    return WorkerHealthOut(
        status=status,
        version=__version__,
        last_seen_at=last_seen,
        worker_id=worker_id,
    )


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
