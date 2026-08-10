"""Transient AI provider error detection and backoff helpers."""

from __future__ import annotations

import re

from folium.ai.base import AIProviderError

# HTTP statuses that are usually worth retrying.
_TRANSIENT_STATUS_CODES = frozenset({408, 425, 429, 500, 502, 503, 504})

# LM Studio / local-server phrases seen in production when models are swapped.
_TRANSIENT_MESSAGE_RE = re.compile(
    r"(model was unloaded|still in queue|operation canceled|operation cancelled|"
    r"model is loading|failed to load model|try again|temporarily unavailable|"
    r"overloaded|resource.?exhausted|timed?\s*out|network error)",
    re.IGNORECASE,
)

# In-adapter retries while holding the host lock (local providers).
ADAPTER_RETRY_ATTEMPTS = 3
ADAPTER_RETRY_BASE_SECONDS = 1.0

# Job-level backoff after an attempt still fails as transient.
_JOB_RETRY_DELAY_CAP_SECONDS = 60.0


def is_transient_ai_error(exc: BaseException) -> bool:
    """Return True when the failure is likely temporary and worth retrying."""
    if not isinstance(exc, AIProviderError):
        return False
    if exc.status_code is not None and exc.status_code in _TRANSIENT_STATUS_CODES:
        return True
    message = exc.message if isinstance(exc.message, str) else str(exc)
    return bool(_TRANSIENT_MESSAGE_RE.search(message))


def adapter_retry_delay_seconds(attempt: int) -> float:
    """Delay before adapter attempt ``attempt`` (1-based) after a transient failure."""
    if attempt < 1:
        attempt = 1
    return ADAPTER_RETRY_BASE_SECONDS * (2 ** (attempt - 1))


def job_retry_delay_seconds(retry_count: int) -> float:
    """Delay before the next job claim after ``retry_count`` failures (1-based)."""
    if retry_count < 1:
        retry_count = 1
    return float(min(_JOB_RETRY_DELAY_CAP_SECONDS, 2**retry_count))
