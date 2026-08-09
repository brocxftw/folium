"""Trash workspace endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from folium.api.schemas import MessageOut, TrashPurgeOut
from folium.auth.deps import CurrentUser, SafeSession
from folium.core.config import get_settings
from folium.db.session import get_db
from folium.models import Document, Folder, FolderKind
from folium.services import documents as doc_service
from folium.storage.service import StorageService

router = APIRouter(prefix="/api/trash", tags=["trash"])


@router.get("/count")
async def trash_count(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, int]:
    docs = (
        await db.execute(
            select(func.count())
            .select_from(Document)
            .where(
                Document.owner_id == _user.id,
                Document.is_trashed.is_(True),
            )
        )
    ).scalar_one()
    folders = (
        await db.execute(
            select(func.count())
            .select_from(Folder)
            .where(
                Folder.owner_id == _user.id,
                Folder.is_trashed.is_(True),
                Folder.kind == FolderKind.NORMAL,
            )
        )
    ).scalar_one()
    return {
        "documents": int(docs),
        "folders": int(folders),
        "total": int(docs) + int(folders),
        "retention_days": get_settings().trash_retention_days,
    }


@router.post("/purge", response_model=TrashPurgeOut)
async def purge_trash(
    _sess: SafeSession,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TrashPurgeOut:
    """Permanently delete trash items past the retention window."""
    result = await doc_service.purge_expired_trash(
        db,
        owner_id=_user.id,
        storage=StorageService(),
    )
    return TrashPurgeOut(**result)


@router.post("/empty", response_model=MessageOut)
async def empty_trash(
    _sess: SafeSession,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageOut:
    """Permanently delete all trashed documents and empty trashed folders now."""
    result = await doc_service.empty_trash(
        db,
        owner_id=_user.id,
        storage=StorageService(),
    )
    return MessageOut(
        message=(
            f"Permanently deleted {result['deleted_documents']} document(s) "
            f"and {result['deleted_folders']} folder(s)"
        )
    )
