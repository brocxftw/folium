import { describe, expect, it } from "vitest";
import type { Document } from "@/lib/api/types";
import {
  documentNeedsProcessingPoll,
  documentsNeedProcessingPoll,
} from "./retrievalReadiness";

function doc(partial: Partial<Document>): Document {
  return {
    id: "1",
    title: "t",
    original_filename: "t.pdf",
    mime_type: "application/pdf",
    file_size: 1,
    page_count: 1,
    folder_id: "f",
    owner_id: "o",
    checksum: "c",
    storage_key: "s",
    inbox: false,
    is_trashed: false,
    is_archived: false,
    text_extracted: true,
    ocr_completed: true,
    document_indexed: false,
    has_embeddings: false,
    needs_review: false,
    processing_status: "ready",
    created_at: "",
    updated_at: "",
    ...partial,
  } as Document;
}

describe("documentsNeedProcessingPoll", () => {
  it("returns true while embedding in progress", () => {
    const embedding = doc({
      document_indexed: true,
      has_embeddings: false,
      chunks_total: 10,
      chunks_embedded: 0,
    });
    expect(documentNeedsProcessingPoll(embedding)).toBe(true);
    expect(documentsNeedProcessingPoll([embedding])).toBe(true);
  });

  it("returns false when semantic ready", () => {
    const ready = doc({
      document_indexed: true,
      has_embeddings: true,
      chunks_total: 10,
      chunks_embedded: 10,
    });
    expect(documentNeedsProcessingPoll(ready)).toBe(false);
    expect(documentsNeedProcessingPoll([ready])).toBe(false);
  });
});
