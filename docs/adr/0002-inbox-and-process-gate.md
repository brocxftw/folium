# ADR-0002: Inbox review and Process gate

## Status
Accepted

## Context
Ingested files could be indexed for RAG immediately.

## Decision
Default ingest lands in **Inbox**. Preflight (extract/OCR, optional suggestions) runs first. **Process** is the explicit human action that leaves Inbox, materializes pending folder paths, and enqueues **INDEXING** (chunks).

## Rationale
Human-controlled filing. Tests and `process_inbox_documents` encode the gate. Keyword FTS may still run on preflight text.

## Consequences
Inbox Ready ≠ Keyword ready ≠ Semantic ready. Library uploads that specify a folder can skip Inbox and index after preflight (documented exception).

## Alternatives considered
Auto-file everything to a default folder (not the default path). Index at upload (rejected for Inbox docs).
