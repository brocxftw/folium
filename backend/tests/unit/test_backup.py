"""Backup package unit tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from folium.backup.manifest import FORMAT_VERSION, BackupManifest
from folium.backup.paths import bundle_path, repository_path
from folium.backup.retention import apply_retention
from folium.backup.schedule import next_run_after
from folium.backup.verify import check_version_compatibility
from folium.core.exceptions import ValidationError
from folium.models import BackupScheduleType, BackupSettings


def test_manifest_round_trip() -> None:
    manifest = BackupManifest(
        format_version=FORMAT_VERSION,
        folium_version="0.2.0",
        created_at="2026-08-17T00:00:00+00:00",
        database_schema_version="012_backup_restore",
        backup_type="full",
        document_count=3,
        original_bytes=12,
        checksum_algorithm="sha256",
        verification_state="healthy",
    )
    parsed = BackupManifest.from_dict(manifest.to_dict())
    assert parsed.document_count == 3
    assert "password" not in parsed.to_dict()


def test_manifest_missing_fields() -> None:
    with pytest.raises(ValueError, match="missing"):
        BackupManifest.from_dict({"format_version": 1})


def test_unsupported_format_rejected() -> None:
    manifest = BackupManifest(
        format_version=99,
        folium_version="0.1.0",
        created_at="2026-08-17T00:00:00+00:00",
        database_schema_version="011_ask_conversations",
        backup_type="full",
        document_count=0,
        original_bytes=0,
        checksum_algorithm="sha256",
        verification_state="unverified",
    )
    ok, messages = check_version_compatibility(manifest)
    assert ok is False
    assert any("Unsupported" in msg for msg in messages)


def test_newer_backup_version_rejected() -> None:
    manifest = BackupManifest(
        format_version=1,
        folium_version="99.0.0",
        created_at="2026-08-17T00:00:00+00:00",
        database_schema_version="011_ask_conversations",
        backup_type="full",
        document_count=0,
        original_bytes=0,
        checksum_algorithm="sha256",
        verification_state="unverified",
    )
    ok, messages = check_version_compatibility(manifest)
    assert ok is False
    assert any("newer" in msg for msg in messages)


def test_path_traversal_rejected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from folium.core.config import get_settings

    monkeypatch.setenv("BACKUPS_PATH", str(tmp_path))
    get_settings.cache_clear()
    with pytest.raises(ValidationError):
        bundle_path("../etc/passwd")
    with pytest.raises(ValidationError):
        repository_path("../../secret")
    get_settings.cache_clear()


def test_schedule_daily_advances() -> None:
    settings = BackupSettings(id=1, schedule_type=BackupScheduleType.DAILY, backup_time="02:00")
    after = datetime(2026, 8, 17, 3, 0, tzinfo=UTC)
    nxt = next_run_after(settings, after)
    assert nxt.date().isoformat() == "2026-08-18"
    assert nxt.hour == 2


def test_checksum_mismatch(tmp_path: Path) -> None:
    from folium.backup.bundle import verify_checksums, write_checksums

    file_a = tmp_path / "a.txt"
    file_a.write_text("hello", encoding="utf-8")
    write_checksums(tmp_path, [file_a])
    file_a.write_text("tampered", encoding="utf-8")
    with pytest.raises(ValueError, match="Checksum mismatch"):
        verify_checksums(tmp_path)


@pytest.mark.asyncio
async def test_retention_skips_failed_backups(db_session: AsyncSession) -> None:
    from folium.models import BackupRecord, BackupRecordStatus, BackupVerificationStatus
    from folium.services.backup import get_or_create_settings

    policy = await get_or_create_settings(db_session)
    policy.retention_count = 1
    failed = BackupRecord(
        filename="folium-20260817T000000Z-00000000-0000-0000-0000-000000000099.folium",
        relative_key="failed.folium",
        status=BackupRecordStatus.FAILED,
        verification_status=BackupVerificationStatus.FAILED,
    )
    good = BackupRecord(
        filename="folium-20260817T000001Z-00000000-0000-0000-0000-000000000098.folium",
        relative_key="good.folium",
        status=BackupRecordStatus.COMPLETED,
        verification_status=BackupVerificationStatus.HEALTHY,
    )
    db_session.add_all([failed, good])
    await db_session.flush()
    deleted = await apply_retention(db_session, policy)
    assert deleted == []
    remaining = (await db_session.execute(select(BackupRecord))).scalars().all()
    assert {r.status for r in remaining} >= {BackupRecordStatus.FAILED, BackupRecordStatus.COMPLETED}


def test_schedule_interval_advances() -> None:
    settings = BackupSettings(
        id=1,
        schedule_type=BackupScheduleType.INTERVAL_HOURS,
        backup_time="02:00",
        interval_hours=6,
    )
    after = datetime(2026, 8, 17, 10, 0, tzinfo=UTC)
    nxt = next_run_after(settings, after)
    assert nxt == after + timedelta(hours=6)


def test_schedule_weekly_and_missed_daily_fires_once() -> None:
    weekly = BackupSettings(
        id=1,
        schedule_type=BackupScheduleType.WEEKLY,
        backup_time="02:00",
        weekday=0,
    )
    monday = datetime(2026, 8, 17, 3, 0, tzinfo=UTC)  # Monday after 02:00
    nxt = next_run_after(weekly, monday)
    assert nxt.weekday() == 0
    assert nxt.date().isoformat() == "2026-08-24"

    daily = BackupSettings(id=1, schedule_type=BackupScheduleType.DAILY, backup_time="02:00")
    late = datetime(2026, 8, 17, 15, 0, tzinfo=UTC)
    nxt_daily = next_run_after(daily, late)
    assert nxt_daily == datetime(2026, 8, 18, 2, 0, tzinfo=UTC)


def test_older_schema_is_compatible() -> None:
    manifest = BackupManifest(
        format_version=1,
        folium_version="0.1.0",
        created_at="2026-08-01T00:00:00+00:00",
        database_schema_version="011_ask_conversations",
        backup_type="full",
        document_count=0,
        original_bytes=0,
        checksum_algorithm="sha256",
        verification_state="healthy",
    )
    ok, messages = check_version_compatibility(manifest)
    assert ok is True
    assert any("migrated" in msg for msg in messages)


def test_corrupt_dump_rejected(tmp_path: Path) -> None:
    from folium.backup.dump import pg_tools_available, validate_dump_readable

    if not pg_tools_available():
        pytest.skip("PostgreSQL 17 client (pg_restore) is not available")
    dump = tmp_path / "folium.dump"
    dump.write_bytes(b"not-a-postgres-dump")
    with pytest.raises(RuntimeError, match="not readable"):
        validate_dump_readable(dump)


def test_tar_path_traversal_rejected(tmp_path: Path) -> None:
    import tarfile

    from folium.backup.bundle import extract_bundle

    archive = tmp_path / "evil.tar"
    with tarfile.open(archive, "w") as tar:
        info = tarfile.TarInfo(name="../evil.txt")
        payload = b"nope"
        info.size = len(payload)
        tar.addfile(info, fileobj=__import__("io").BytesIO(payload))
    dest = tmp_path / "out"
    with pytest.raises(ValueError, match="Unsafe"):
        extract_bundle(archive, dest)


def test_interrupted_temp_not_published(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from folium.core.config import get_settings
    from folium.services.backup import startup_cleanup

    monkeypatch.setenv("BACKUPS_PATH", str(tmp_path))
    get_settings.cache_clear()
    staging = tmp_path / ".folium-backup-abc.tmp"
    staging.mkdir()
    (staging / "partial").write_text("incomplete", encoding="utf-8")
    part = tmp_path / "folium-20260817T000000Z-00000000-0000-0000-0000-000000000001.folium.part"
    part.write_bytes(b"partial-tar")
    startup_cleanup()
    assert not staging.exists()
    assert not part.exists()
    assert list(tmp_path.glob("*.folium")) == []
    get_settings.cache_clear()
