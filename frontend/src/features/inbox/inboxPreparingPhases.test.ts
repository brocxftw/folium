import { describe, expect, it } from "vitest";
import type { Document, Job } from "@/lib/api/types";
import {
  inboxBatchProgress,
  inboxRowProgress,
  indexingPhaseState,
  ocrPhaseState,
  resolveProcessingLabel,
} from "./inboxPreparingPhases";

function doc(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    inbox_status: "preparing",
    processing_status: "processing",
    text_extracted: false,
    ocr_completed: false,
    ...overrides,
  } as Document;
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    document_id: "doc-1",
    job_type: "text_extraction",
    status: "running",
    priority: 100,
    retry_count: 0,
    error: null,
    created_at: "2026-01-01T00:00:00Z",
    started_at: "2026-01-01T00:00:00Z",
    completed_at: null,
    ...overrides,
  } as Job;
}

describe("ocrPhaseState", () => {
  it("runs while text extraction is active", () => {
    expect(
      ocrPhaseState(doc(), [job({ job_type: "text_extraction", status: "running" })]),
    ).toBe("running");
  });

  it("is done once text is extracted and OCR jobs finished", () => {
    expect(
      ocrPhaseState(
        doc({ text_extracted: true }),
        [job({ job_type: "text_extraction", status: "completed" })],
      ),
    ).toBe("done");
  });
});

describe("indexingPhaseState", () => {
  it("is pending until OCR completes", () => {
    expect(
      indexingPhaseState(doc(), [job({ job_type: "text_extraction", status: "running" })]),
    ).toBe("pending");
  });

  it("runs while metadata suggestion is active", () => {
    expect(
      indexingPhaseState(
        doc({ text_extracted: true }),
        [job({ job_type: "metadata_suggestion", status: "running" })],
      ),
    ).toBe("running");
  });

  it("is pending while thumbnail runs after OCR", () => {
    expect(
      indexingPhaseState(
        doc({ text_extracted: true }),
        [job({ job_type: "thumbnail", status: "running" })],
      ),
    ).toBe("pending");
  });
});

describe("resolveProcessingLabel", () => {
  it("progresses Queued → OCR → Indexing → needs review", () => {
    expect(
      resolveProcessingLabel(
        doc(),
        [job({ job_type: "text_extraction", status: "queued" })],
      ),
    ).toBe("queued");
    expect(
      resolveProcessingLabel(
        doc(),
        [job({ job_type: "text_extraction", status: "running" })],
      ),
    ).toBe("ocr");
    expect(
      resolveProcessingLabel(
        doc({ text_extracted: true }),
        [job({ job_type: "metadata_suggestion", status: "running" })],
      ),
    ).toBe("indexing");
    expect(resolveProcessingLabel(doc({ inbox_status: "needs_review" }))).toBe(
      "needs_review",
    );
  });
});

describe("inboxRowProgress", () => {
  it("hides the bar when the document is no longer preparing", () => {
    expect(inboxRowProgress(doc({ inbox_status: "ready" }))).toBeNull();
  });

  it("hides the bar for queued rows", () => {
    expect(
      inboxRowProgress(
        doc(),
        [job({ job_type: "text_extraction", status: "queued" })],
      ),
    ).toBeNull();
  });

  it("shows page progress during OCR", () => {
    expect(
      inboxRowProgress(
        doc({ ocr_pages_done: 3, ocr_pages_total: 6 }),
        [job({ job_type: "ocr", status: "running" })],
      ),
    ).toEqual({
      label: "OCR · Processing page 3 of 6",
      percent: 50,
    });
  });

  it("treats page 0 as the first page label", () => {
    expect(
      inboxRowProgress(
        doc({ ocr_pages_done: 0, ocr_pages_total: 6 }),
        [job({ job_type: "ocr", status: "running" })],
      ),
    ).toEqual({
      label: "OCR · Processing page 1 of 6",
      percent: 0,
    });
  });
});

describe("inboxBatchProgress", () => {
  it("counts completed vs queued vs one active OCR job", () => {
    const docs = [
      doc({ id: "a", inbox_status: "ready" }),
      doc({ id: "b", inbox_status: "preparing" }),
      doc({ id: "c", inbox_status: "preparing" }),
    ];
    const jobs = [
      job({ document_id: "b", job_type: "ocr", status: "running" }),
      job({ id: "job-2", document_id: "c", job_type: "text_extraction", status: "queued" }),
    ];
    expect(inboxBatchProgress(docs, jobs)).toEqual({
      total: 3,
      completed: 1,
      active: 1,
      queued: 1,
      percent: 33,
      visible: true,
    });
  });
});
