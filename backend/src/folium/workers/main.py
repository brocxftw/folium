"""Folium background worker entrypoint."""

from __future__ import annotations

import asyncio
import os
import socket

from folium.core.config import get_settings
from folium.core.logging import get_logger, setup_logging
from folium.db.session import session_scope
from folium.services import jobs as job_service
from folium.storage.service import StorageService
from folium.workers.processor import process_consume_file, process_job

logger = get_logger(__name__)


def worker_id() -> str:
    return f"{socket.gethostname()}-{os.getpid()}"


async def _poll_jobs(wid: str, sem: asyncio.Semaphore) -> None:
    settings = get_settings()
    async with session_scope() as session:
        await job_service.requeue_stale_running(session)

    async with session_scope() as session:
        job = await job_service.claim_next(session, wid)

    if job is None:
        return

    async def _run() -> None:
        async with sem:
            try:
                async with session_scope() as session:
                    fresh = await job_service.get_job(session, job.id)
                    result = await process_job(session, fresh)
                    await job_service.complete_job(session, fresh.id, result)
                logger.info("Completed job %s (%s)", job.id, job.job_type.value)
            except Exception as exc:
                logger.exception("Job %s failed: %s", job.id, exc)
                async with session_scope() as session:
                    failed = await job_service.fail_job(session, job.id, str(exc))
                    from folium.models import JobStatus
                    from folium.workers.processor import (
                        PREFLIGHT_JOB_TYPES,
                        mark_preflight_failed,
                    )

                    if (
                        failed.status == JobStatus.FAILED
                        and failed.document_id is not None
                        and failed.job_type in PREFLIGHT_JOB_TYPES
                    ):
                        await mark_preflight_failed(
                            session, failed.document_id, str(exc)
                        )

    asyncio.create_task(_run())


async def _poll_consume(stability_wait: float) -> None:
    storage = StorageService()
    files = storage.list_consume_files()
    if not files:
        return

    await asyncio.sleep(stability_wait)

    for path in files:
        if not path.is_file():
            continue
        if not storage.is_file_stable(path):
            continue
        try:
            async with session_scope() as session:
                doc_id = await process_consume_file(session, path, storage=storage)
            if doc_id:
                logger.info("Consumed %s -> document %s", path.name, doc_id)
        except Exception as exc:
            logger.exception("Failed to consume %s: %s", path, exc)


async def _poll_trash_purge(last_run: list[float]) -> None:
    """Periodically purge trash older than the retention window."""
    import time

    settings = get_settings()
    now = time.monotonic()
    if last_run[0] and now - last_run[0] < settings.trash_purge_interval_seconds:
        return
    last_run[0] = now
    try:
        from folium.services import documents as doc_service

        async with session_scope() as session:
            result = await doc_service.purge_expired_trash(
                session,
                owner_id=None,
                storage=StorageService(),
            )
        if result["deleted_documents"] or result["deleted_folders"]:
            logger.info(
                "Purged trash: %s document(s), %s folder(s) (retention=%sd)",
                result["deleted_documents"],
                result["deleted_folders"],
                result["retention_days"],
            )
    except Exception as exc:
        logger.exception("Trash purge failed: %s", exc)


async def worker_loop() -> None:
    settings = get_settings()
    wid = worker_id()
    sem = asyncio.Semaphore(settings.job_concurrency)
    last_purge: list[float] = [0.0]
    logger.info("Worker %s started (concurrency=%s)", wid, settings.job_concurrency)

    while True:
        tasks = [
            _poll_jobs(wid, sem),
            _poll_consume(settings.consume_poll_interval_seconds),
            _poll_trash_purge(last_purge),
        ]
        await asyncio.gather(*tasks)
        await asyncio.sleep(settings.job_poll_interval_seconds)


def run_worker() -> None:
    setup_logging()
    storage = StorageService()
    storage.ensure_layout()
    asyncio.run(worker_loop())


if __name__ == "__main__":
    run_worker()
