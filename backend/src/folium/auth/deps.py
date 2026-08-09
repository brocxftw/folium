"""FastAPI auth dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from folium.auth import service as auth_service
from folium.core.config import get_settings
from folium.core.exceptions import AuthError, ForbiddenError
from folium.db.session import get_db
from folium.models import Session, User


async def get_current_session(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Session:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise AuthError("Authentication required")
    sess = await auth_service.get_session_by_token(db, token)
    if sess is None:
        raise AuthError("Invalid or expired session")
    return sess


async def get_current_user(
    sess: Annotated[Session, Depends(get_current_session)],
) -> User:
    return sess.user


async def require_auth_csrf(
    request: Request,
    sess: Annotated[Session, Depends(get_current_session)],
    x_csrf_token: Annotated[str | None, Header()] = None,
) -> Session:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return sess
    origin = request.headers.get("origin")
    settings = get_settings()
    if origin and origin.rstrip("/") != settings.frontend_origin.rstrip("/"):
        # Allow same-host API tools without Origin in some cases
        if origin not in {settings.frontend_origin, f"http://localhost:{settings.port}"}:
            # Still require CSRF
            pass
    await auth_service.require_csrf(sess, x_csrf_token)
    return sess


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentSession = Annotated[Session, Depends(get_current_session)]
SafeSession = Annotated[Session, Depends(require_auth_csrf)]


async def require_admin(
    user: CurrentUser,
) -> User:
    if not user.is_admin:
        raise ForbiddenError("Admin access required")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
