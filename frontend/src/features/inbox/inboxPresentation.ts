import type { Document } from "@/lib/api/types";

/** Overview presentation status (mapped from existing inbox fields). */
export type PresentationStatus =
  | "queued"
  | "processing"
  | "processed"
  | "needs_review"
  | "failed";

export type ActivityTab = "recent" | "processed" | "failed";

export type DateRangeDays = 7 | 30;

export interface OverviewMetrics {
  processed: number;
  failed: number;
  processing: number;
  totalIngested: number;
  successRate: number | null;
}

export function toPresentationStatus(doc: Document): PresentationStatus | null {
  const status = doc.inbox_status;
  if (!status) return null;
  if (status === "failed") return "failed";
  if (status === "ready") return "processed";
  if (status === "needs_review") return "needs_review";
  if (status === "preparing") {
    return doc.processing_status === "processing" ? "processing" : "queued";
  }
  return null;
}

export function presentationLabel(status: PresentationStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "processing":
      return "Processing";
    case "processed":
      return "Processed";
    case "needs_review":
      return "Needs review";
    case "failed":
      return "Failed";
  }
}

export function fileTypeLabel(doc: Document): string {
  const mime = doc.mime_type;
  if (mime === "application/pdf") return "PDF";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "DOCX";
  }
  if (mime === "application/msword") return "DOC";
  if (mime === "text/csv") return "CSV";
  if (mime === "text/plain") return "TXT";
  if (mime.startsWith("image/")) {
    return mime.slice(6).toUpperCase() || "Image";
  }
  if (mime.includes("zip")) return "ZIP";
  const fromName = doc.original_filename.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toUpperCase();
  return mime.split("/").pop()?.toUpperCase() || "File";
}

export function processedAtValue(doc: Document): string | null {
  return doc.indexed_at ?? null;
}

export function inDateRange(doc: Document, days: DateRangeDays, now = new Date()): boolean {
  const added = new Date(doc.added_date);
  if (Number.isNaN(added.getTime())) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return added >= start && added <= now;
}

export function filterByActivityTab(docs: Document[], tab: ActivityTab): Document[] {
  if (tab === "recent") return docs;
  if (tab === "failed") {
    return docs.filter((d) => d.inbox_status === "failed");
  }
  return docs.filter(
    (d) => d.inbox_status === "ready" || d.inbox_status === "needs_review",
  );
}

export function computeOverviewMetrics(
  docs: Document[],
  days: DateRangeDays,
  now = new Date(),
): OverviewMetrics {
  const inRange = docs.filter((d) => inDateRange(d, days, now));
  let processed = 0;
  let failed = 0;
  let processing = 0;

  for (const doc of inRange) {
    const status = doc.inbox_status;
    if (status === "ready" || status === "needs_review") processed += 1;
    else if (status === "failed") failed += 1;
    else if (status === "preparing") processing += 1;
  }

  const terminal = processed + failed;
  return {
    processed,
    failed,
    processing,
    totalIngested: inRange.length,
    successRate: terminal === 0 ? null : (processed / terminal) * 100,
  };
}

export function matchesSearch(doc: Document, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    doc.original_filename.toLowerCase().includes(q) ||
    doc.title.toLowerCase().includes(q) ||
    (doc.document_type_name?.toLowerCase().includes(q) ?? false)
  );
}

export function matchesPresentationFilter(
  doc: Document,
  filter: PresentationStatus | "all",
): boolean {
  if (filter === "all") return true;
  return toPresentationStatus(doc) === filter;
}
