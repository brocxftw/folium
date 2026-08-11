import { describe, expect, it } from "vitest";
import type { Document, Job } from "@/lib/api/types";
import { indexingPhaseState, ocrPhaseState, resolveProcessingLabel } from "./inboxPreparingPhases";

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
  it("progresses OCR → Indexing → needs review", () => {
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
