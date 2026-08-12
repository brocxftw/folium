import type { Document } from "@/lib/api/types";

/** True when preflight / AI suggestion work has finished for this document. */
export function isDocSettled(doc: Document): boolean {
  if (doc.inbox_status === "preparing") return false;
  if (
    doc.processing_status === "pending" ||
    doc.processing_status === "processing"
  ) {
    return false;
  }
  return true;
}

/** Settled rows that can re-run AI filing suggestions (not failed preflight). */
export function canRetrySuggestions(doc: Document): boolean {
  return doc.inbox_status === "ready" || doc.inbox_status === "needs_review";
}

export function visibleSelectedDocs(
  documents: Document[],
  selectedIds: Set<string>,
): Document[] {
  return documents.filter((d) => selectedIds.has(d.id));
}
