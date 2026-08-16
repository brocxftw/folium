# ADR-0003: Logical folders and content-addressed storage

## Status
Accepted

## Context
NAS/NFS is expensive to shuffle. Users still want folder trees.

## Decision
Originals are stored by **SHA-256** key under `/documents/originals`. **Folders are metadata** (`folder_id`, `path_cache`). Moves do not relocate blobs.

## Rationale
Implemented in `StorageService` and `move_document`. Unique `(owner_id, checksum)` for active documents.

## Consequences
Duplicates are content-based. Physical layout does not mirror the UI tree. Backup must include both DB and the originals tree.

## Alternatives considered
Filesystem tree matching logical folders (would move large files on NFS).
