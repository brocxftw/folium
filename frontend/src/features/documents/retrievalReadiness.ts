import type { Document } from "@/lib/api/types";

export type RetrievalReadiness =
  | "preparing"
  | "review_required"
  | "ready_to_process"
  | "indexing"
  | "embedding"
  | "keyword_ready"
  | "semantic_ready"
  | "failed"
  | "partial";

export interface ReadinessInfo {
  key: RetrievalReadiness;
  label: string;
  description: string;
  tone: "muted" | "warning" | "danger" | "accent" | "success";
}

const INFO: Record<RetrievalReadiness, Omit<ReadinessInfo, "key">> = {
  preparing: {
    label: "Preparing",
    description: "Text extraction or OCR is still running.",
    tone: "muted",
  },
  review_required: {
    label: "Needs review",
    description: "Inbox metadata needs confirmation before processing.",
    tone: "warning",
  },
  ready_to_process: {
    label: "Ready to process",
    description: "Preflight is complete. Process from Inbox to index for RAG.",
    tone: "accent",
  },
  indexing: {
    label: "Indexing",
    description: "Final chunk indexing has not finished yet.",
    tone: "muted",
  },
  embedding: {
    label: "Embedding",
    description: "Chunks are indexed; semantic embeddings are still running.",
    tone: "muted",
  },
  keyword_ready: {
    label: "Keyword ready",
    description: "Indexed for keyword retrieval. Semantic embeddings are not available yet.",
    tone: "accent",
  },
  semantic_ready: {
    label: "Semantic ready",
    description: "Indexed and embedded for hybrid keyword + semantic retrieval.",
    tone: "success",
  },
  failed: {
    label: "Failed",
    description: "Processing failed. Retry from Inbox or Jobs.",
    tone: "danger",
  },
  partial: {
    label: "Partial",
    description: "Processing completed with gaps. Some chunks may lack embeddings.",
    tone: "warning",
  },
};

export function getEmbeddingProgress(doc: Document): {
  total: number;
  embedded: number;
  failed: number;
  percent: number | null;
} {
  const total = doc.chunks_total ?? 0;
  const embedded = doc.chunks_embedded ?? 0;
  const failed = doc.chunks_failed ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((embedded / total) * 100)) : null;
  return { total, embedded, failed, percent };
}

function isEmbeddingInProgress(doc: Document): boolean {
  if (!doc.document_indexed || doc.has_embeddings) return false;
  if (doc.embedding_error) return false;
  const total = doc.chunks_total ?? 0;
  const embedded = doc.chunks_embedded ?? 0;
  if (total > 0 && embedded < total) return true;
  // Indexed with chunks but embeddings not started / still queued.
  return total > 0 || doc.embedding_started_at != null;
}

export function getRetrievalReadiness(doc: Document): RetrievalReadiness {
  if (doc.processing_status === "failed") return "failed";
  if (doc.processing_status === "partial") return "partial";

  if (
    doc.processing_status === "pending" ||
    doc.processing_status === "processing" ||
    !doc.text_extracted
  ) {
    return "preparing";
  }

  if (doc.inbox) {
    if (doc.inbox_status === "failed") return "failed";
    if (doc.needs_review || doc.inbox_status === "needs_review") return "review_required";
    if (doc.inbox_status === "ready") return "ready_to_process";
    return "preparing";
  }

  if (!doc.document_indexed) return "indexing";
  if (doc.has_embeddings && (doc.chunks_failed ?? 0) === 0) return "semantic_ready";
  if (doc.has_embeddings && (doc.chunks_failed ?? 0) > 0) return "partial";
  if (isEmbeddingInProgress(doc)) return "embedding";
  return "keyword_ready";
}

export function getReadinessInfo(doc: Document): ReadinessInfo {
  const key = getRetrievalReadiness(doc);
  const info = { key, ...INFO[key] };
  if (key === "embedding") {
    const { embedded, total, percent } = getEmbeddingProgress(doc);
    if (total > 0 && percent != null) {
      info.label = `Embedding ${percent}%`;
      info.description = `Embedded ${embedded.toLocaleString()} of ${total.toLocaleString()} chunks.`;
    }
  }
  return info;
}

export function isUnprocessedDocument(doc: Document): boolean {
  const readiness = getRetrievalReadiness(doc);
  return (
    readiness === "preparing" ||
    readiness === "review_required" ||
    readiness === "ready_to_process" ||
    readiness === "indexing" ||
    readiness === "embedding" ||
    readiness === "failed" ||
    readiness === "partial"
  );
}

export function canAskDocument(doc: Document): boolean {
  return doc.document_indexed || doc.has_embeddings;
}

/** True when the UI should poll for indexing/embedding progress updates. */
export function documentNeedsProcessingPoll(doc: Document): boolean {
  const readiness = getRetrievalReadiness(doc);
  return readiness === "indexing" || readiness === "embedding";
}

export function documentsNeedProcessingPoll(docs: Document[]): boolean {
  return docs.some(documentNeedsProcessingPoll);
}
