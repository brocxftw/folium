"""Aggregate API router."""

from __future__ import annotations

from fastapi import APIRouter

from folium.api import ai, ask, auth, documents, folders, health, jobs, search, tags, trash, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(folders.router)
api_router.include_router(tags.router)
api_router.include_router(documents.router)
api_router.include_router(trash.router)
api_router.include_router(search.router)
api_router.include_router(ask.router)
api_router.include_router(jobs.router)
api_router.include_router(ai.router)
