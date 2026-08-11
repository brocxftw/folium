import type { Document, InboxStatus, Job } from "@/lib/api/types";

export type PhaseState = "pending" | "running" | "done";

/** Single processing label shown on the combined status pill. */
export type ProcessingLabel = "ocr" | "indexing" | InboxStatus;

const OCR_JOB_TYPES = ["text_extraction", "ocr"] as const;
const INDEXING_JOB_TYPES = ["metadata_suggestion"] as const;

function hasActiveJob(
  jobs: Job[] | undefined,
  documentId: string,
  types: readonly string[],
): boolean {
  if (!jobs?.length) return false;
  return jobs.some(
    (j) =>
      j.document_id === documentId &&
      types.includes(j.job_type) &&
      (j.status === "queued" || j.status === "running"),
  );
}

/** OCR / text extraction stage while a document is preparing. */
export function ocrPhaseState(doc: Document, jobs?: Job[]): PhaseState {
  if (hasActiveJob(jobs, doc.id, OCR_JOB_TYPES)) return "running";
  if (doc.text_extracted) return "done";
  return "running";
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

/** Resolve the single status pill label: OCR → Indexing → inbox status. */
export function resolveProcessingLabel(doc: Document, jobs?: Job[]): ProcessingLabel {
  const status = doc.inbox_status;
  if (status === "failed" || status === "ready" || status === "needs_review") {
    return status;
  }
  if (ocrPhaseState(doc, jobs) !== "done") return "ocr";
  return "indexing";
}

export const PROCESSING_LABEL_TEXT: Record<ProcessingLabel, string> = {
  ocr: "OCR",
  indexing: "Indexing",
  preparing: "Preparing",
  ready: "Ready",
  needs_review: "Needs review",
  failed: "Failed",
};
