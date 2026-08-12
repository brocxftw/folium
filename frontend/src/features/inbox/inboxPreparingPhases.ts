import type { Document, InboxStatus, Job } from "@/lib/api/types";

export type PhaseState = "pending" | "running" | "done";

/** Single processing label shown on the combined status pill. */
export type ProcessingLabel = "queued" | "ocr" | "indexing" | InboxStatus;

const OCR_JOB_TYPES = ["text_extraction", "ocr"] as const;
const INDEXING_JOB_TYPES = ["metadata_suggestion"] as const;

function hasJob(
  jobs: Job[] | undefined,
  documentId: string,
  types: readonly string[],
  statuses: readonly string[],
): boolean {
  if (!jobs?.length) return false;
  return jobs.some(
    (j) =>
      j.document_id === documentId &&
      types.includes(j.job_type) &&
      statuses.includes(j.status),
  );
}

function hasActiveJob(
  jobs: Job[] | undefined,
  documentId: string,
  types: readonly string[],
): boolean {
  return hasJob(jobs, documentId, types, ["queued", "running"]);
}

export function hasRunningOcrJob(jobs: Job[] | undefined, documentId: string): boolean {
  return hasJob(jobs, documentId, OCR_JOB_TYPES, ["running"]);
}

/** OCR / text extraction stage while a document is preparing. */
export function ocrPhaseState(doc: Document, jobs?: Job[]): PhaseState {
  if (hasActiveJob(jobs, doc.id, OCR_JOB_TYPES)) return "running";
  if (doc.text_extracted) return "done";
  return "pending";
}

/** AI filing-suggestion stage (metadata_suggestion) after OCR/text is ready. */
export function indexingPhaseState(doc: Document, jobs?: Job[]): PhaseState {
  if (ocrPhaseState(doc, jobs) !== "done") return "pending";
  if (hasActiveJob(jobs, doc.id, INDEXING_JOB_TYPES)) return "running";
  if (
    doc.inbox_status === "preparing" ||
    doc.processing_status === "pending" ||
    doc.processing_status === "processing"
  ) {
    if (!jobs?.length) return "running";
    if (hasActiveJob(jobs, doc.id, ["thumbnail"])) return "pending";
    return "running";
  }
  return "done";
}

/** Resolve the single status pill label: Queued → OCR → Indexing → inbox status. */
export function resolveProcessingLabel(doc: Document, jobs?: Job[]): ProcessingLabel {
  const status = doc.inbox_status;
  if (status === "failed" || status === "ready" || status === "needs_review") {
    return status;
  }
  if (hasRunningOcrJob(jobs, doc.id)) return "ocr";
  if (!doc.text_extracted) return "queued";
  if (ocrPhaseState(doc, jobs) !== "done") return "ocr";
  return "indexing";
}

export const PROCESSING_LABEL_TEXT: Record<ProcessingLabel, string> = {
  queued: "Queued",
  ocr: "OCR",
  indexing: "Indexing",
  preparing: "Preparing",
  ready: "Ready",
  needs_review: "Needs review",
  failed: "Failed",
};

export type InboxRowProgress = {
  label: string;
  percent: number | null;
};

export function inboxRowProgress(doc: Document, jobs?: Job[]): InboxRowProgress | null {
  if (doc.inbox_status !== "preparing") return null;
  const phase = resolveProcessingLabel(doc, jobs);
  if (phase === "queued") return null;
  if (phase === "ocr") {
    const done = doc.ocr_pages_done;
    const total = doc.ocr_pages_total;
    if (total != null && total > 0 && done != null) {
      const page = Math.min(Math.max(done, 1), total);
      return {
        label: `OCR · Processing page ${page} of ${total}`,
        percent: Math.round((Math.min(Math.max(done, 0), total) / total) * 100),
      };
    }
    return { label: "OCR · Extracting…", percent: null };
  }
  return { label: "Indexing…", percent: null };
}

export type InboxBatchProgress = {
  total: number;
  completed: number;
  active: number;
  queued: number;
  percent: number;
  visible: boolean;
};

/** Batch totals for the current inbox scope (typically the full unfiltered list). */
export function inboxBatchProgress(
  docs: Document[],
  jobs?: Job[],
): InboxBatchProgress {
  const total = docs.length;
  const completed = docs.filter(
    (d) => d.inbox_status != null && d.inbox_status !== "preparing",
  ).length;
  const preparing = docs.filter((d) => d.inbox_status === "preparing");
  const active = preparing.filter((d) => hasRunningOcrJob(jobs, d.id)).length;
  const queued = Math.max(0, preparing.length - active);
  return {
    total,
    completed,
    active,
    queued,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    visible: preparing.length > 0,
  };
}
