"""AI / OCR capability health: status derivation and lightweight probing."""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from folium.ai.assignments import ResolvedAssignment, ensure_assignments, resolve_assignment
from folium.ai.registry import get_adapter
from folium.bootstrap import ensure_ai_settings
from folium.core.config import get_settings
from folium.core.logging import get_logger
from folium.core.redaction import redact_text
from folium.db.session import session_scope
from folium.models import AIProvider, AIWorkloadRole
from folium.ocr.paddle_engine import get_paddle_import_error, paddle_ocr_available

logger = get_logger(__name__)

HEALTH_PROBE_INTERVAL_SECONDS = 3.0
# Keep probes cheap: a down provider must not stall OCR / extract job polling.
HEALTH_PROBE_TIMEOUT_SECONDS = 5.0

CapabilityName = Literal["ocr", "indexing", "embedding", "chat"]
CapabilityStatus = Literal["available", "unavailable", "checking", "not_configured"]

_PROBE_ROLES = (
    AIWorkloadRole.INDEXING,
    AIWorkloadRole.EMBEDDING,
    AIWorkloadRole.CHAT,
)


@dataclass(slots=True, frozen=True)
class CapabilityHealth:
    capability: CapabilityName
    status: CapabilityStatus
    provider: str | None
    model: str | None
    latency_ms: int | None
    last_checked: datetime | None
    error: str | None


@dataclass(slots=True, frozen=True)
class AIHealthReport:
    ocr: CapabilityHealth
    indexing: CapabilityHealth
    embedding: CapabilityHealth
    chat: CapabilityHealth
    auto_tagging: bool
    auto_enrichment: bool


def derive_ocr_capability() -> CapabilityHealth:
    settings = get_settings()
    if not settings.ocr_enabled:
        return CapabilityHealth(
            capability="ocr",
            status="not_configured",
            provider="paddleocr",
            model=None,
            latency_ms=None,
            last_checked=datetime.now(UTC),
            error="OCR_ENABLED is false",
        )
    if paddle_ocr_available():
        return CapabilityHealth(
            capability="ocr",
            status="available",
            provider="paddleocr",
            model=settings.ocr_language,
            latency_ms=None,
            last_checked=datetime.now(UTC),
            error=None,
        )
    return CapabilityHealth(
        capability="ocr",
        status="unavailable",
        provider="paddleocr",
        model=settings.ocr_language,
        latency_ms=None,
        last_checked=datetime.now(UTC),
        error=get_paddle_import_error() or "PaddleOCR is not available",
    )


def derive_role_capability(
    *,
    capability: CapabilityName,
    resolved: ResolvedAssignment,
) -> CapabilityHealth:
    provider = resolved.provider
    model = resolved.model
    if provider is None or not model:
        return CapabilityHealth(
            capability=capability,
            status="not_configured",
            provider=None,
            model=model,
            latency_ms=None,
            last_checked=None,
            error=None,
        )
    if not provider.enabled:
        return CapabilityHealth(
            capability=capability,
            status="unavailable",
            provider=provider.name,
            model=model,
            latency_ms=provider.last_probe_latency_ms,
            last_checked=provider.last_probed_at,
            error="Provider is disabled",
        )
    if provider.last_probed_at is None and provider.last_probe_status is None:
        return CapabilityHealth(
            capability=capability,
            status="checking",
            provider=provider.name,
            model=model,
            latency_ms=None,
            last_checked=None,
            error=None,
        )
    if provider.last_probe_status == "offline":
        return CapabilityHealth(
            capability=capability,
            status="unavailable",
            provider=provider.name,
            model=model,
            latency_ms=provider.last_probe_latency_ms,
            last_checked=provider.last_probed_at,
            error=provider.last_probe_error,
        )
    if provider.last_probe_status == "available":
        return CapabilityHealth(
            capability=capability,
            status="available",
            provider=provider.name,
            model=model,
            latency_ms=provider.last_probe_latency_ms,
            last_checked=provider.last_probed_at,
            error=None,
        )
    # Unknown / stale probe marker — treat as checking until a probe lands.
    return CapabilityHealth(
        capability=capability,
        status="checking",
        provider=provider.name,
        model=model,
        latency_ms=provider.last_probe_latency_ms,
        last_checked=provider.last_probed_at,
        error=provider.last_probe_error,
    )


async def build_ai_health_report(session: AsyncSession) -> AIHealthReport:
    settings_row = await ensure_ai_settings(session)
    await ensure_assignments(session)
    indexing = await resolve_assignment(session, AIWorkloadRole.INDEXING)
    embedding = await resolve_assignment(session, AIWorkloadRole.EMBEDDING)
    chat = await resolve_assignment(session, AIWorkloadRole.CHAT)
    return AIHealthReport(
        ocr=derive_ocr_capability(),
        indexing=derive_role_capability(capability="indexing", resolved=indexing),
        embedding=derive_role_capability(capability="embedding", resolved=embedding),
        chat=derive_role_capability(capability="chat", resolved=chat),
        auto_tagging=bool(settings_row.auto_tagging),
        auto_enrichment=bool(settings_row.auto_enrichment),
    )


async def _list_assigned_provider_ids(session: AsyncSession) -> list[uuid.UUID]:
    await ensure_assignments(session)
    seen: set[uuid.UUID] = set()
    ordered: list[uuid.UUID] = []
    for role in _PROBE_ROLES:
        resolved = await resolve_assignment(session, role)
        provider = resolved.provider
        if provider is None or not resolved.model:
            continue
        if not provider.enabled:
            continue
        if provider.id in seen:
            continue
        seen.add(provider.id)
        ordered.append(provider.id)
    return ordered


async def probe_provider(provider: AIProvider) -> None:
    """Run a cheap connection probe and persist last_probe_* on the provider."""
    adapter = get_adapter(provider, timeout=HEALTH_PROBE_TIMEOUT_SECONDS)
    started = time.perf_counter()
    tested_at = datetime.now(UTC)
    try:
        ok = await asyncio.wait_for(
            adapter.test_connection(),
            timeout=HEALTH_PROBE_TIMEOUT_SECONDS + 1.0,
        )
    except TimeoutError:
        provider.last_probe_status = "offline"
        provider.last_probe_error = "Health probe timed out"
        provider.last_probe_latency_ms = round((time.perf_counter() - started) * 1000)
        provider.last_probed_at = tested_at
        logger.warning("AI health probe timed out provider=%s", provider.name)
        return
    except Exception as exc:
        provider.last_probe_status = "offline"
        provider.last_probe_error = redact_text(str(exc))[:512]
        provider.last_probe_latency_ms = round((time.perf_counter() - started) * 1000)
        provider.last_probed_at = tested_at
        logger.warning("AI health probe offline provider=%s: %s", provider.name, exc)
        return
    finally:
        await adapter.aclose()

    latency = round((time.perf_counter() - started) * 1000)
    provider.last_probe_latency_ms = latency
    provider.last_probed_at = tested_at
    if ok:
        provider.last_probe_status = "available"
        provider.last_probe_error = None
        provider.last_success_at = tested_at
        logger.debug("AI health probe ok provider=%s latency_ms=%s", provider.name, latency)
    else:
        provider.last_probe_status = "offline"
        provider.last_probe_error = "Provider connection test failed"
        logger.warning("AI health probe failed provider=%s", provider.name)


async def probe_assigned_providers(session: AsyncSession | None = None) -> int:
    """Probe unique enabled providers assigned to indexing/embedding/chat.

    When ``session`` is omitted, each provider is probed in its own short-lived
    session so this can run as a background worker task safely.

    Returns the number of providers probed.
    """
    if session is not None:
        provider_ids = await _list_assigned_provider_ids(session)
        count = 0
        for provider_id in provider_ids:
            provider = await session.get(AIProvider, provider_id)
            if provider is None or not provider.enabled:
                continue
            await probe_provider(provider)
            count += 1
        await session.flush()
        return count

    async with session_scope() as short:
        provider_ids = await _list_assigned_provider_ids(short)

    count = 0
    for provider_id in provider_ids:
        async with session_scope() as short:
            provider = await short.get(AIProvider, provider_id)
            if provider is None or not provider.enabled:
                continue
            await probe_provider(provider)
            count += 1
    return count
