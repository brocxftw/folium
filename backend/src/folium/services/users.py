"""User registration, profile, invites, and admin user management."""

from __future__ import annotations

import re
import time
import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from folium.auth.passwords import generate_token, hash_password, hash_token, verify_password
from folium.core.config import get_settings
from folium.core.exceptions import (
    AuthError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from folium.models import Document, Folder, Invite, Session, User
from folium.services import folders as folder_service
from folium.services import quotas as quota_service
from folium.storage.service import StorageService

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
_login_attempts: dict[str, list[float]] = defaultdict(list)


def _validate_username(username: str) -> str:
    username = username.strip()
    if not _USERNAME_RE.match(username):
        raise ValidationError(
            "Username must be 3–32 characters and contain only letters, numbers, and underscores"
        )
    return username


def _validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters")


def check_login_rate_limit(
    key: str, *, max_attempts: int = 10, window_seconds: float = 300
) -> None:
    now = time.monotonic()
    window = [t for t in _login_attempts[key] if now - t < window_seconds]
    _login_attempts[key] = window
    if len(window) >= max_attempts:
        raise AuthError("Too many login attempts. Try again later.")


def record_login_failure(key: str) -> None:
    _login_attempts[key].append(time.monotonic())


def clear_login_failures(key: str) -> None:
    _login_attempts.pop(key, None)


async def register_user(
    session: AsyncSession,
    *,
    username: str,
    password: str,
    display_name: str,
    invite_token: str | None = None,
) -> User:
    settings = get_settings()
    username = _validate_username(username)
    _validate_password(password)
    display_name = display_name.strip() or username

    invite: Invite | None = None
    if invite_token:
        invite = await get_valid_invite(session, invite_token)
    elif not settings.allow_registration:
        raise ForbiddenError("Registration is disabled")

    existing = (
        await session.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("Username is already taken")

    user = User(
        username=username,
        password_hash=hash_password(password),
        display_name=display_name,
        is_admin=False,
        is_active=True,
        storage_quota_bytes=invite.storage_quota_bytes
        if invite
        else settings.default_storage_quota_bytes,
        ai_monthly_request_quota=(
            invite.ai_monthly_request_quota if invite else settings.default_ai_monthly_request_quota
        ),
    )
    session.add(user)
    await session.flush()
    await folder_service.ensure_system_folders(session, user.id)

    if invite is not None:
        invite.used_at = datetime.now(UTC)
        invite.used_by_id = user.id
        await session.flush()

    return user


async def update_profile(
    session: AsyncSession,
    user: User,
    *,
    display_name: str | None = None,
    username: str | None = None,
) -> User:
    if display_name is not None:
        name = display_name.strip()
        if not name:
            raise ValidationError("Display name is required")
        user.display_name = name
    if username is not None:
        username = _validate_username(username)
        if username != user.username:
            conflict = (
                await session.execute(select(User).where(User.username == username))
            ).scalar_one_or_none()
            if conflict:
                raise ConflictError("Username is already taken")
            user.username = username
    await session.flush()
    return user


async def change_password(
    session: AsyncSession,
    user: User,
    *,
    current_password: str,
    new_password: str,
    keep_session_id: uuid.UUID | None = None,
) -> None:
    if not verify_password(user.password_hash, current_password):
        raise AuthError("Current password is incorrect")
    _validate_password(new_password)
    user.password_hash = hash_password(new_password)
    await session.flush()
    # Revoke other sessions
    stmt = delete(Session).where(Session.user_id == user.id)
    if keep_session_id is not None:
        stmt = stmt.where(Session.id != keep_session_id)
    await session.execute(stmt)


async def list_users(session: AsyncSession) -> list[User]:
    return list(
        (await session.execute(select(User).order_by(User.created_at.asc()))).scalars().all()
    )


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user


async def admin_update_user(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    is_admin: bool | None = None,
    is_active: bool | None = None,
    storage_quota_bytes: int | None | object = ...,
    ai_monthly_request_quota: int | None | object = ...,
    actor: User,
) -> User:
    user = await get_user(session, user_id)
    if is_admin is not None and user.is_admin and not is_admin:
        admins = (
            await session.execute(
                select(func.count())
                .select_from(User)
                .where(User.is_admin.is_(True), User.is_active.is_(True))
            )
        ).scalar_one()
        if admins <= 1:
            raise ValidationError("Cannot demote the last admin")
        if user.id == actor.id:
            raise ValidationError("Cannot demote yourself")
    if is_admin is not None:
        user.is_admin = is_admin
    if is_active is not None:
        if user.id == actor.id and not is_active:
            raise ValidationError("Cannot deactivate yourself")
        user.is_active = is_active
        if not is_active:
            await session.execute(delete(Session).where(Session.user_id == user.id))
    if storage_quota_bytes is not ...:
        user.storage_quota_bytes = storage_quota_bytes  # type: ignore[assignment]
    if ai_monthly_request_quota is not ...:
        user.ai_monthly_request_quota = ai_monthly_request_quota  # type: ignore[assignment]
    await session.flush()
    return user


async def admin_set_password(session: AsyncSession, user_id: uuid.UUID, password: str) -> User:
    user = await get_user(session, user_id)
    _validate_password(password)
    user.password_hash = hash_password(password)
    await session.execute(delete(Session).where(Session.user_id == user.id))
    await session.flush()
    return user


async def delete_user(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    actor: User,
    storage: StorageService | None = None,
) -> None:
    from folium.services import documents as doc_service

    user = await get_user(session, user_id)
    if user.id == actor.id:
        raise ValidationError("Cannot delete yourself")
    if user.is_admin:
        admins = (
            await session.execute(
                select(func.count()).select_from(User).where(User.is_admin.is_(True))
            )
        ).scalar_one()
        if admins <= 1:
            raise ValidationError("Cannot delete the last admin")

    storage = storage or StorageService()
    doc_ids = (
        (await session.execute(select(Document.id).where(Document.owner_id == user.id)))
        .scalars()
        .all()
    )
    for doc_id in doc_ids:
        doc = await session.get(Document, doc_id)
        if doc is None:
            continue
        # Force permanent delete even if not trashed
        doc.is_trashed = True
        await session.flush()
        await doc_service.permanently_delete(
            session,
            doc_id,
            owner_id=user.id,
            storage=storage,
        )

    await session.execute(delete(Folder).where(Folder.owner_id == user.id))
    await session.delete(user)
    await session.flush()


async def create_invite(
    session: AsyncSession,
    *,
    created_by: User,
    expires_in_hours: int = 168,
    storage_quota_bytes: int | None = None,
    ai_monthly_request_quota: int | None = None,
) -> tuple[Invite, str]:
    raw = generate_token(24)
    invite = Invite(
        token_hash=hash_token(raw),
        created_by_id=created_by.id,
        expires_at=datetime.now(UTC) + timedelta(hours=expires_in_hours),
        storage_quota_bytes=storage_quota_bytes,
        ai_monthly_request_quota=ai_monthly_request_quota,
    )
    session.add(invite)
    await session.flush()
    return invite, raw


async def list_invites(session: AsyncSession) -> list[Invite]:
    return list(
        (await session.execute(select(Invite).order_by(Invite.created_at.desc()).limit(100)))
        .scalars()
        .all()
    )


async def get_valid_invite(session: AsyncSession, raw_token: str) -> Invite:
    invite = (
        await session.execute(select(Invite).where(Invite.token_hash == hash_token(raw_token)))
    ).scalar_one_or_none()
    if invite is None:
        raise NotFoundError("Invite not found")
    if invite.used_at is not None:
        raise ValidationError("Invite has already been used")
    if invite.expires_at < datetime.now(UTC):
        raise ValidationError("Invite has expired")
    return invite


async def revoke_invite(session: AsyncSession, invite_id: uuid.UUID) -> None:
    invite = await session.get(Invite, invite_id)
    if invite is None:
        raise NotFoundError("Invite not found")
    if invite.used_at is not None:
        raise ValidationError("Invite already used")
    await session.delete(invite)
    await session.flush()


async def user_usage_summary(session: AsyncSession, user: User) -> dict:
    storage_used = await quota_service.storage_usage_bytes(session, user.id)
    ai_used = await quota_service.ai_requests_this_month(session, user.id)
    return {
        "storage_used_bytes": storage_used,
        "storage_quota_bytes": user.storage_quota_bytes,
        "ai_requests_this_month": ai_used,
        "ai_monthly_request_quota": user.ai_monthly_request_quota,
    }
