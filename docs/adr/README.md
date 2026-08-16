# Architecture Decision Records

ADRs record **durable, intentional** choices. Number sequentially: `ADR-0001`, `ADR-0002`, ….

## Template

```markdown
# ADR-XXXX: Title

## Status
Accepted | Proposed | Superseded | Deprecated

## Context
## Decision
## Rationale
## Consequences
## Alternatives considered
```

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-ai-is-optional.md) | AI is optional | Accepted |
| [0002](0002-inbox-and-process-gate.md) | Inbox review and Process gate | Accepted |
| [0003](0003-logical-folders-content-addressed-storage.md) | Logical folders vs content-addressed blobs | Accepted |
| [0004](0004-postgres-pgvector-job-queue.md) | PostgreSQL + pgvector + DB job queue | Accepted |
| [0005](0005-host-mounted-nfs.md) | Host-mounted NFS, not app-mounted | Accepted |

Historical design discussion is **not** archived in git. Rationale below is inferred from implementation, tests, and `ubiquitous-language.md`.
