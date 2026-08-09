"""Admin-only safe-scope operational information."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from folium.api.schemas import DiagnosticsOut, StorageMetricsOut, SystemSummaryOut
from folium.auth.deps import AdminUser
from folium.db.session import get_db
from folium.services.system_info import storage_metrics, system_summary

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/summary", response_model=SystemSummaryOut)
async def summary(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SystemSummaryOut:
    return SystemSummaryOut(**await system_summary(db))


@router.get("/storage", response_model=StorageMetricsOut)
async def storage(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StorageMetricsOut:
    return StorageMetricsOut(**await storage_metrics(db))


@router.get("/diagnostics", response_model=DiagnosticsOut)
async def diagnostics(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DiagnosticsOut:
    info = await system_summary(db)
    lines = [
        "Folium diagnostics",
        f"Generated: {datetime.now(UTC).isoformat()}",
        f"Version: {info['version']}",
        f"Schema: {info['schema_revision']}",
        f"Uptime seconds: {info['process_uptime_seconds']}",
        f"Database: {info['database_status']}",
        f"Storage: {info['storage_status']}",
        f"Worker: {info['worker_status']}",
        f"Documents: {info['document_count']} ({info['indexed_document_count']} indexed)",
        f"Runtime scope: {info['runtime']['scope']}",
        f"OS/architecture: {info['runtime']['os']} / {info['runtime']['architecture']}",
        "Host paths, endpoint URLs, environment variables, credentials, "
        "and document content omitted.",
    ]
    return DiagnosticsOut(generated_at=datetime.now(UTC), text="\n".join(lines))
