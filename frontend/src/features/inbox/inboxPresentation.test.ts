import { describe, expect, it } from "vitest";
import type { Document } from "@/lib/api/types";
import {
  computeOverviewMetrics,
  filterByActivityTab,
  inDateRange,
  toPresentationStatus,
} from "@/features/inbox/inboxPresentation";

function doc(partial: Partial<Document> & Pick<Document, "id">): Document {
  return {
    title: "Doc",
    original_filename: "doc.pdf",
    mime_type: "application/pdf",
    file_size: 1024,
    page_count: 1,
    language: null,
    notes: null,
    archive_serial: null,
    folder_id: "f1",
    folder_path: "Inbox",
    document_type_id: null,
    document_type_name: null,
    correspondent_id: null,
    correspondent_name: null,
    tags: [],
    created_date: null,
    effective_date: null,
    added_date: new Date().toISOString(),
    modified_date: new Date().toISOString(),
    indexed_at: null,
    processing_status: "ready",
    ocr_completed: false,
    text_extracted: true,
    document_indexed: false,
    has_embeddings: false,
    processing_error: null,
    is_archived: false,
    is_trashed: false,
    trashed_at: null,
    inbox: true,
    needs_review: false,
    inbox_status: "ready",
    pending_folder_path: null,
    custom_fields: {},
    ai_summary: null,
    ai_summary_meta: null,
    has_thumbnail: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe("inboxPresentation", () => {
  it("maps inbox statuses to presentation badges", () => {
    expect(
      toPresentationStatus(doc({ id: "1", inbox_status: "preparing", processing_status: "pending" })),
    ).toBe("queued");
    expect(
      toPresentationStatus(
        doc({ id: "2", inbox_status: "preparing", processing_status: "processing" }),
      ),
    ).toBe("processing");
    expect(toPresentationStatus(doc({ id: "3", inbox_status: "ready" }))).toBe("processed");
    expect(toPresentationStatus(doc({ id: "4", inbox_status: "needs_review" }))).toBe(
      "needs_review",
    );
    expect(toPresentationStatus(doc({ id: "5", inbox_status: "failed" }))).toBe("failed");
  });

  it("filters activity tabs", () => {
    const items = [
      doc({ id: "a", inbox_status: "ready" }),
      doc({ id: "b", inbox_status: "needs_review" }),
      doc({ id: "c", inbox_status: "failed" }),
      doc({ id: "d", inbox_status: "preparing", processing_status: "pending" }),
    ];
    expect(filterByActivityTab(items, "recent")).toHaveLength(4);
    expect(filterByActivityTab(items, "processed").map((d) => d.id)).toEqual(["a", "b"]);
    expect(filterByActivityTab(items, "failed").map((d) => d.id)).toEqual(["c"]);
  });

  it("computes overview metrics for the selected range", () => {
    const now = new Date("2026-08-10T12:00:00Z");
    const items = [
      doc({
        id: "1",
        inbox_status: "ready",
        added_date: "2026-08-09T10:00:00Z",
      }),
      doc({
        id: "2",
        inbox_status: "failed",
        added_date: "2026-08-08T10:00:00Z",
      }),
      doc({
        id: "3",
        inbox_status: "preparing",
        processing_status: "processing",
        added_date: "2026-08-10T08:00:00Z",
      }),
      doc({
        id: "4",
        inbox_status: "ready",
        added_date: "2026-07-01T10:00:00Z",
      }),
    ];

    expect(inDateRange(items[3], 7, now)).toBe(false);

    const metrics = computeOverviewMetrics(items, 7, now);
    expect(metrics.processed).toBe(1);
    expect(metrics.failed).toBe(1);
    expect(metrics.processing).toBe(1);
    expect(metrics.totalIngested).toBe(3);
    expect(metrics.successRate).toBe(50);
  });
});
