"""Admin user management and invites."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from folium.api.schemas import (
    AdminSetPasswordRequest,
    InviteCreateRequest,
    InviteOut,
    MessageOut,
    UserAdminOut,
    UserAdminUpdate,
)
from folium.auth.deps import AdminUser, SafeSession
from folium.db.session import get_db
from folium.services import users as user_service
from folium.storage.service import StorageService

router = APIRouter(prefix="/api/users", tags=["users"])


def _admin_out(user, usage: dict) -> UserAdminOut:
    return UserAdminOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        is_admin=user.is_admin,
        is_active=user.is_active,
        storage_quota_bytes=user.storage_quota_bytes,
        ai_monthly_request_quota=user.ai_monthly_request_quota,
        created_at=user.created_at,
        storage_used_bytes=usage["storage_used_bytes"],
        ai_requests_this_month=usage["ai_requests_this_month"],
    )


@router.get("", response_model=list[UserAdminOut])
async def list_users(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[UserAdminOut]:
    users = await user_service.list_users(db)
    out: list[UserAdminOut] = []
    for user in users:
        usage = await user_service.user_usage_summary(db, user)
        out.append(_admin_out(user, usage))
    return out


@router.get("/invites", response_model=list[InviteOut])
async def list_invites(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[InviteOut]:
    invites = await user_service.list_invites(db)
    return [InviteOut.model_validate(i) for i in invites]


@router.post("/invites", response_model=InviteOut)
async def create_invite(
    body: InviteCreateRequest,
    _sess: SafeSession,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InviteOut:
    invite, raw = await user_service.create_invite(
        db,
        created_by=admin,
        expires_in_hours=body.expires_in_hours,
        storage_quota_bytes=body.storage_quota_bytes,
        ai_monthly_request_quota=body.ai_monthly_request_quota,
    )
    out = InviteOut.model_validate(invite)
    out.invite_url_token = raw
    return out


@router.delete("/invites/{invite_id}", response_model=MessageOut)
async def revoke_invite(
    invite_id: uuid.UUID,
    _sess: SafeSession,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageOut:
    await user_service.revoke_invite(db, invite_id)
    return MessageOut(message="Invite revoked")


@router.patch("/{user_id}", response_model=UserAdminOut)
async def update_user(
    user_id: uuid.UUID,
    body: UserAdminUpdate,
    _sess: SafeSession,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserAdminOut:
    storage_q: object = ...
    ai_q: object = ...
    if body.clear_storage_quota:
        storage_q = None
    elif body.storage_quota_bytes is not None:
        storage_q = body.storage_quota_bytes
    if body.clear_ai_quota:
        ai_q = None
    elif body.ai_monthly_request_quota is not None:
        ai_q = body.ai_monthly_request_quota

    user = await user_service.admin_update_user(
        db,
        user_id,
        is_admin=body.is_admin,
        is_active=body.is_active,
        storage_quota_bytes=storage_q,
        ai_monthly_request_quota=ai_q,
        actor=admin,
    )
    usage = await user_service.user_usage_summary(db, user)
    return _admin_out(user, usage)


@router.post("/{user_id}/password", response_model=MessageOut)
async def set_user_password(
    user_id: uuid.UUID,
    body: AdminSetPasswordRequest,
    _sess: SafeSession,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageOut:
    await user_service.admin_set_password(db, user_id, body.password)
    return MessageOut(message="Password updated")


@router.delete("/{user_id}", response_model=MessageOut)
async def delete_user(
    user_id: uuid.UUID,
    _sess: SafeSession,
    admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageOut:
    await user_service.delete_user(db, user_id, actor=admin, storage=StorageService())
    return MessageOut(message="User deleted")
