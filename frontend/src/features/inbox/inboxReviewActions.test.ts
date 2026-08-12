import { describe, expect, it } from "vitest";
import type { Document } from "@/lib/api/types";
import {
  canRetrySuggestions,
  isDocSettled,
  visibleSelectedDocs,
} from "./inboxReviewActions";

function doc(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    inbox_status: "preparing",
    processing_status: "processing",
    ...overrides,
  } as Document;
}

describe("isDocSettled", () => {
  it("is false while preparing", () => {
    expect(isDocSettled(doc())).toBe(false);
  });

  it("is true when ready", () => {
    expect(
      isDocSettled(doc({ inbox_status: "ready", processing_status: "ready" })),
    ).toBe(true);
  });
});

describe("canRetrySuggestions", () => {
  it("allows ready and needs_review rows only", () => {
    expect(
      canRetrySuggestions(doc({ inbox_status: "ready", processing_status: "ready" })),
    ).toBe(true);
    expect(
      canRetrySuggestions(
        doc({ inbox_status: "needs_review", processing_status: "ready" }),
      ),
    ).toBe(true);
    expect(canRetrySuggestions(doc())).toBe(false);
    expect(
      canRetrySuggestions(doc({ inbox_status: "failed", processing_status: "failed" })),
    ).toBe(false);
  });
});

describe("visibleSelectedDocs", () => {
  it("returns only selected rows in the current list", () => {
    const docs = [doc({ id: "a" }), doc({ id: "b" }), doc({ id: "c" })];
    expect(visibleSelectedDocs(docs, new Set(["b", "z"]))).toEqual([docs[1]]);
  });
});
