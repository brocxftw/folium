import { describe, expect, it } from "vitest";
import type { Document, Suggestion } from "@/lib/api/types";
import { hasManualDestination, shouldAcceptSuggestion } from "./suggestionAcceptFilter";

const baseDoc = {
  id: "doc-1",
  pending_folder_path: null,
  folder_path: "Inbox",
} as Document;

const folderSuggestion: Suggestion = {
  id: "sug-1",
  document_id: "doc-1",
  field: "folder",
  value: { path: "Finance / Tax", create: true },
  status: "pending",
  provider: null,
  model: null,
  confidence: null,
};

describe("hasManualDestination", () => {
  it("returns false for system inbox only", () => {
    expect(hasManualDestination(baseDoc)).toBe(false);
  });

  it("returns true for pending new folder path", () => {
    expect(
      hasManualDestination({ ...baseDoc, pending_folder_path: "Finance / Tax" }),
    ).toBe(true);
  });

  it("returns true for assigned non-inbox folder", () => {
    expect(
      hasManualDestination({ ...baseDoc, folder_path: "Finance / Tax" }),
    ).toBe(true);
  });
});

describe("shouldAcceptSuggestion", () => {
  it("skips folder suggestion when destination was changed manually", () => {
    const doc = { ...baseDoc, pending_folder_path: "Legal / Contracts" };
    expect(shouldAcceptSuggestion(doc, folderSuggestion)).toBe(false);
  });

  it("accepts folder suggestion when no manual destination", () => {
    expect(shouldAcceptSuggestion(baseDoc, folderSuggestion)).toBe(true);
  });

  it("accepts non-folder suggestions regardless of destination", () => {
    const doc = { ...baseDoc, pending_folder_path: "Legal / Contracts" };
    const tags = { ...folderSuggestion, field: "tags", value: { tag_names: ["tax"] } };
    expect(shouldAcceptSuggestion(doc, tags)).toBe(true);
  });
});
