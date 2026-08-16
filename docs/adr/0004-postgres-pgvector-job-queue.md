# ADR-0004: PostgreSQL, pgvector, and a database-backed job queue

## Status
Accepted

## Context
Search, metadata, and background work could use Elasticsearch, Redis, etc.

## Decision
One PostgreSQL 17 + pgvector instance holds metadata, FTS, embeddings, and the **jobs** queue (`SKIP LOCKED`). No Redis.

## Rationale
Operational simplicity for homelab Compose. Migrations and tests assume this topology.

## Consequences
Job throughput and search scale are those of Postgres. Operators back up one database volume plus file storage.

## Alternatives considered
Redis/RQ/Celery (not present). Dedicated search engine (not present).
