import { describe, expect, it } from "vitest";
import type { Job } from "@/lib/api/types";
import {
  showSuggestionFailure,
  suggestionJobStatusForDoc,
} from "./suggestionJobStatus";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    document_id: "doc-1",
    job_type: "metadata_suggestion",
    status: "completed",
    priority: 70,
    retry_count: 0,
    error: null,
    created_at: "2026-01-01T00:00:00Z",
    started_at: "2026-01-01T00:00:01Z",
    completed_at: "2026-01-01T00:00:02Z",
    ...overrides,
  } as Job;
}

describe("suggestionJobStatusForDoc", () => {
  it("does not treat accepted (zero pending) suggestions as a hard failure", () => {
    expect(suggestionJobStatusForDoc([job()], "doc-1", 0)).toBe("empty");
    expect(showSuggestionFailure("empty")).toBe(false);
  });

  it("falls back to manual filing only when the suggestion job failed", () => {
    expect(
      suggestionJobStatusForDoc([job({ status: "failed" })], "doc-1", 0),
    ).toBe("failed");
    expect(showSuggestionFailure("failed")).toBe(true);
  });
});
