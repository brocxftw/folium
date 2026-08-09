"""Authentication endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from folium.api.schemas import (
    LoginRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    RegistrationStatusOut,
    SessionOut,
    UserOut,
    UserUsageOut,
)
from folium.auth import service as auth_service
from folium.auth.deps import CurrentSession, CurrentUser, SafeSession
from folium.core.config import get_settings
from folium.core.exceptions import AuthError
from folium.db.session import get_db
from folium.services import users as user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _use_secure_cookies() -> bool:
    settings = get_settings()
    return (not settings.is_dev) and settings.frontend_origin.startswith("https://")


def _cookie_options() -> dict[str, object]:
    settings = get_settings()
    return {
        "httponly": True,
        "secure": _use_secure_cookies(),
        "samesite": "lax",
        "max_age": settings.session_ttl_hours * 3600,
        "path": "/",
    }


def _csrf_cookie_options() -> dict[str, object]:
    settings = get_settings()
    return {
        "httponly": False,
        "secure": _use_secure_cookies(),
        "samesite": "lax",
        "max_age": settings.session_ttl_hours * 3600,
        "path": "/",
    }


def _set_session_cookies(response: Response, raw_token: str, csrf_token: str) -> None:
    settings = get_settings()
    response.set_cookie(settings.session_cookie_name, raw_token, **_cookie_options())
    response.set_cookie(settings.csrf_cookie_name, csrf_token, **_csrf_cookie_options())


def _clear_session_cookies(response: Response) -> None:
    """Expire auth cookies using the same attributes they were set with."""
    settings = get_settings()
    common = {
        "path": "/",
        "secure": _use_secure_cookies(),
        "samesite": "lax",
    }
    response.delete_cookie(
        settings.session_cookie_name,
        httponly=True,
        **common,
    )
    response.delete_cookie(
        settings.csrf_cookie_name,
        httponly=False,
        **common,
    )

@router.get("/registration-status", response_model=RegistrationStatusOut)
async def registration_status() -> RegistrationStatusOut:
    return RegistrationStatusOut(allow_registration=get_settings().allow_registration)


@router.post("/register", response_model=SessionOut)
async def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SessionOut:
    user = await user_service.register_user(
        db,
        username=body.username,
        password=body.password,
        display_name=body.display_name,
        invite_token=body.invite_token,
    )
    sess, raw_token = await auth_service.create_session(
        db,
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_session_cookies(response, raw_token, sess.csrf_token)
    return SessionOut(user=UserOut.model_validate(user), csrf_token=sess.csrf_token)


@router.post("/login", response_model=SessionOut)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SessionOut:
    rate_key = (request.client.host if request.client else "unknown") + ":" + body.username.lower()
    user_service.check_login_rate_limit(rate_key)
    try:
        user = await auth_service.authenticate(db, body.username, body.password)
    except AuthError:
        user_service.record_login_failure(rate_key)
        raise
    user_service.clear_login_failures(rate_key)
    sess, raw_token = await auth_service.create_session(
        db,
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_session_cookies(response, raw_token, sess.csrf_token)
    return SessionOut(
        user=UserOut.model_validate(user),
        csrf_token=sess.csrf_token,
    )


@router.post("/logout")
async def logout(
    response: Response,
    sess: SafeSession,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    await auth_service.revoke_session(db, sess.id)
    _clear_session_cookies(response)
    return {"message": "Logged out"}


@router.get("/me", response_model=SessionOut)
async def me(sess: CurrentSession) -> SessionOut:
    return SessionOut(
        user=UserOut.model_validate(sess.user),
        csrf_token=sess.csrf_token,
    )


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: ProfileUpdateRequest,
    _sess: SafeSession,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserOut:
    updated = await user_service.update_profile(
        db,
        user,
        display_name=body.display_name,
        username=body.username,
    )
    return UserOut.model_validate(updated)


@router.post("/me/password")
async def change_my_password(
    body: PasswordChangeRequest,
    response: Response,
    sess: SafeSession,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    await user_service.change_password(
        db,
        user,
        current_password=body.current_password,
        new_password=body.new_password,
        keep_session_id=None,  # revoke every session — caller must sign in again
    )
    _clear_session_cookies(response)
    return {"message": "Password updated. Please sign in again."}

@router.get("/me/usage", response_model=UserUsageOut)
async def my_usage(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserUsageOut:
    return UserUsageOut(**await user_service.user_usage_summary(db, user))
