"""Job requeue helpers."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from folium.models import Document, Folder, FolderKind, Job, JobStatus, JobType, User
from folium.services import jobs as job_service


async def _owner_and_folder(db_session: AsyncSession) -> tuple[uuid.UUID, uuid.UUID]:
    user = User(
        username=f"jobs_{uuid.uuid4().hex[:8]}",
        password_hash="unused",
        display_name="Jobs",
    )
    db_session.add(user)
    await db_session.flush()
    folder = Folder(owner_id=user.id, name="Inbox", kind=FolderKind.INBOX, path_cache="Inbox")
    db_session.add(folder)
    await db_session.flush()
    return user.id, folder.id


@pytest.mark.asyncio
async def test_requeue_all_running(db_session: AsyncSession) -> None:
    running = Job(
        job_type=JobType.TEXT_EXTRACTION,
        status=JobStatus.RUNNING,
        locked_by="dead-worker-1",
        priority=50,
    )
    queued = Job(
        job_type=JobType.THUMBNAIL,
        status=JobStatus.QUEUED,
        priority=50,
    )
    db_session.add_all([running, queued])
    await db_session.flush()

    n = await job_service.requeue_all_running(db_session)
    assert n == 1
    await db_session.commit()

    rows = (await db_session.execute(select(Job))).scalars().all()
    by_type = {j.job_type: j for j in rows}
    assert by_type[JobType.TEXT_EXTRACTION].status == JobStatus.QUEUED
    assert by_type[JobType.TEXT_EXTRACTION].locked_by is None
    assert by_type[JobType.THUMBNAIL].status == JobStatus.QUEUED


@pytest.mark.asyncio
async def test_cancel_jobs_for_trashed_documents(db_session: AsyncSession) -> None:
    owner_id, folder_id = await _owner_and_folder(db_session)
    live = Document(
        owner_id=owner_id,
        title="live",
        original_filename="live.txt",
        storage_key="k-live",
        checksum=f"c-live-{uuid.uuid4().hex}",
        mime_type="text/plain",
        file_size=1,
        folder_id=folder_id,
        inbox=True,
        is_trashed=False,
    )
    trash = Document(
        owner_id=owner_id,
        title="trash",
        original_filename="seg01_t000.png",
        storage_key="k-trash",
        checksum=f"c-trash-{uuid.uuid4().hex}",
        mime_type="image/png",
        file_size=1,
        folder_id=folder_id,
        inbox=False,
        is_trashed=True,
    )
    db_session.add_all([live, trash])
    await db_session.flush()
    live_job = Job(
        job_type=JobType.TEXT_EXTRACTION,
        status=JobStatus.QUEUED,
        document_id=live.id,
        priority=50,
    )
    trash_job = Job(
        job_type=JobType.TEXT_EXTRACTION,
        status=JobStatus.QUEUED,
        document_id=trash.id,
        priority=10,
    )
    db_session.add_all([live_job, trash_job])
    await db_session.flush()

    n = await job_service.cancel_jobs_for_trashed_documents(db_session)
    assert n == 1
    await db_session.commit()

    claimed = await job_service.claim_next(db_session, "worker-test")
    assert claimed is not None
    assert claimed.document_id == live.id
    assert claimed.id == live_job.id
