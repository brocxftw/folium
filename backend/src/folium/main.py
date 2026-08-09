"""Folium FastAPI application entrypoint."""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

from folium import __version__
from folium.api.errors import register_exception_handlers
from folium.api.router import api_router
from folium.bootstrap import bootstrap
from folium.core.config import get_settings
from folium.core.logging import request_id_context, setup_logging
from folium.db.session import dispose_engine, session_scope


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    setup_logging("api")
    async with session_scope() as session:
        await bootstrap(session)
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Folium",
        version=__version__,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin.rstrip("/")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    access_logger = logging.getLogger("folium.api.access")

    @app.middleware("http")
    async def request_context(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        token = request_id_context.set(request_id)
        started = time.perf_counter()
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            access_logger.info(
                "%s %s -> %s",
                request.method,
                request.url.path,
                response.status_code,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000),
                },
            )
            return response
        finally:
            request_id_context.reset(token)

    register_exception_handlers(app)
    app.include_router(api_router)

    return app


app = create_app()


def run_api() -> None:
    settings = get_settings()
    uvicorn.run(
        "folium.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_dev,
    )


if __name__ == "__main__":
    run_api()
