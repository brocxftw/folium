"""Folium background worker entrypoint."""

from __future__ import annotations

import asyncio
import os
import socket
from datetime import UTC, datetime

from folium.ai.health import HEALTH_PROBE_INTERVAL_SECONDS, probe_assigned_providers
from folium.core.config import get_settings
from folium.core.logging import get_logger, setup_logging
from folium.db.session import session_scope
from folium.models import AppSetting
from folium.services import jobs as job_service
from folium.storage.service import StorageService
from folium.workers.processor import process_consume_file, process_job

logger = get_logger(__name__)


def worker_id() -> str:
    return f"{socket.gethostname()}-{os.getpid()}"


async def _poll_jobs(wid: str, sem: asyncio.Semaphore) -> None:
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
                    from folium.ai.base import AIProviderError
                    from folium.ai.retry import is_transient_ai_error, job_retry_delay_seconds
                    from folium.models import JobStatus
                    from folium.workers.processor import (
                        PREFLIGHT_JOB_TYPES,
                        SOFT_FAIL_PREFLIGHT_JOB_TYPES,
                        mark_preflight_failed,
                        mark_preflight_ready,
                    )

                    delay: float | None = None
                    if isinstance(exc, AIProviderError) and is_transient_ai_error(exc):
                        # retry_count is incremented inside fail_job; peek current value.
                        current = await job_service.get_job(session, job.id)
                        delay = job_retry_delay_seconds(current.retry_count + 1)

                    failed = await job_service.fail_job(
                        session, job.id, str(exc), delay_seconds=delay
                    )

                    if (
                        failed.status == JobStatus.FAILED
                        and failed.document_id is not None
                        and failed.job_type in PREFLIGHT_JOB_TYPES
                    ):
                        if failed.job_type in SOFT_FAIL_PREFLIGHT_JOB_TYPES:
                            # AI enrichment is optional — degrade to manual review.
                            logger.warning(
                                "AI preflight soft-failed for doc=%s (%s): %s",
                                failed.document_id,
                                failed.job_type.value,
                                exc,
                            )
                            await mark_preflight_ready(session, failed.document_id)
                        else:
                            await mark_preflight_failed(session, failed.document_id, str(exc))

                    if (
                        failed.status == JobStatus.FAILED
                        and failed.document_id is not None
                        and failed.job_type.value == "embedding"
                    ):
                        from folium.models import Document

                        doc = await session.get(Document, failed.document_id)
                        if doc is not None:
                            # Keep completed vectors; surface actionable status.
                            msg = str(exc)
                            if len(msg) > 400:
                                msg = msg[:397] + "..."
                            doc.embedding_error = msg or "Embedding provider unavailable"
                            if doc.chunks_embedded and doc.chunks_embedded > 0:
                                from folium.models import ProcessingStatus

                                doc.processing_status = ProcessingStatus.PARTIAL
                                doc.has_embeddings = True

                    # SUMMARY is post-Process; terminal AI failure must not alter filing.
                    if (
                        failed.status == JobStatus.FAILED
                        and failed.job_type.value == "summary"
                    ):
                        logger.warning(
                            "SUMMARY soft-failed for doc=%s: %s",
                            failed.document_id,
                            exc,
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
                logger.info("Consumed file -> document %s", doc_id)
        except Exception as exc:
            logger.exception("Failed to consume file: %s", exc)


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


async def _poll_ai_health(last_run: list[float], in_flight: list[asyncio.Task | None]) -> None:
    """Schedule a non-blocking health probe every HEALTH_PROBE_INTERVAL_SECONDS.

    Must not be awaited inside the job-poll gather — a down provider used to
    stall OCR/extract claiming for minutes (adapter 120s × retries).
    """
    import time

    task = in_flight[0]
    if task is not None and not task.done():
        return

    now = time.monotonic()
    if last_run[0] and now - last_run[0] < HEALTH_PROBE_INTERVAL_SECONDS:
        return
    last_run[0] = now

    async def _run() -> None:
        try:
            count = await probe_assigned_providers()
            if count:
                logger.debug("AI health probe completed for %s provider(s)", count)
        except Exception as exc:
            logger.exception("AI health probe failed: %s", exc)

    in_flight[0] = asyncio.create_task(_run())


async def worker_loop() -> None:
    settings = get_settings()
    wid = worker_id()
    sem = asyncio.Semaphore(settings.job_concurrency)
    last_purge: list[float] = [0.0]
    last_ai_health: list[float] = [0.0]
    ai_health_task: list[asyncio.Task | None] = [None]
    logger.info("Worker %s started (concurrency=%s)", wid, settings.job_concurrency)

    while True:
        async with session_scope() as session:
            heartbeat = await session.get(AppSetting, "worker_heartbeat")
            value = {"at": datetime.now(UTC).isoformat(), "worker_id": wid}
            if heartbeat is None:
                session.add(AppSetting(key="worker_heartbeat", value=value))
            else:
                heartbeat.value = value
        # Health probe is fire-and-forget so unreachable AI cannot block jobs.
        await _poll_ai_health(last_ai_health, ai_health_task)
        tasks = [
            _poll_jobs(wid, sem),
            _poll_consume(settings.consume_poll_interval_seconds),
            _poll_trash_purge(last_purge),
        ]
        await asyncio.gather(*tasks)
        await asyncio.sleep(settings.job_poll_interval_seconds)


def run_worker() -> None:
    setup_logging("worker")
    storage = StorageService()
    storage.ensure_layout()
    asyncio.run(worker_loop())


if __name__ == "__main__":
    run_worker()
