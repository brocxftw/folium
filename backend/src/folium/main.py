"""Folium FastAPI application entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from folium import __version__
from folium.api.errors import register_exception_handlers
from folium.api.router import api_router
from folium.bootstrap import bootstrap
from folium.core.config import get_settings
from folium.core.logging import setup_logging
from folium.db.session import dispose_engine, session_scope


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
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
