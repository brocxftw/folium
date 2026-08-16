import { describe, expect, it } from "vitest";
import {
  normalizeDisplayCitationTextForTest,
  rewriteChunkMarkersForDisplay,
  stripRawChunkMarkers,
} from "./citationNormalize";

function extractCitationNumbers(content: string): number[] {
  const re = /\[(\d+)\]/g;
  const out: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    out.push(Number(match[1]));
  }
  return out;
}

describe("Ask continuous citation display", () => {
  it("finds per-message display numbers in rewritten answers", () => {
    expect(extractCitationNumbers("Start with awareness [1]. Then cues [2].")).toEqual([
      1, 2,
    ]);
  });

  it("does not treat raw chunk markers as display citations", () => {
    const raw =
      "Awareness [chunk:ad8609a3-a7f7-46c9-90c1-f2693ba4c0db] matters.";
    expect(extractCitationNumbers(raw)).toEqual([]);
  });

  it("strips multi-id raw chunk groups from display text", () => {
    const raw =
      "Staf [chunk:6a4ae92e-c3d0-4a2d-b385-785dd9616cfb, chunk:2501da27-8ac2-40f8-aed3-83f4d4bc04ee]";
    const cleaned = stripRawChunkMarkers(raw);
    expect(cleaned).toBe("Staf ");
    expect(cleaned).not.toContain("chunk:");
  });

  it("rewrites multi-id raw chunk groups to display numbers", () => {
    const c1 = "6a4ae92e-c3d0-4a2d-b385-785dd9616cfb";
    const c2 = "2501da27-8ac2-40f8-aed3-83f4d4bc04ee";
    const raw = `Staf dan Taktik Gred 2 [chunk:${c1}, chunk:${c2}]`;
    const rewritten = rewriteChunkMarkersForDisplay(raw, [
      {
        display_number: 1,
        chunk_id: c1,
        document_id: "d1",
        page_number: 1,
        title: "Doc",
        quote: null,
      },
      {
        display_number: 2,
        chunk_id: c2,
        document_id: "d1",
        page_number: 2,
        title: "Doc",
        quote: null,
      },
    ]);
    expect(rewritten).toBe("Staf dan Taktik Gred 2 [1][2]");
    expect(rewritten).not.toContain("chunk:");
  });

  it("collapses consecutive duplicate citation numbers", () => {
    expect(normalizeDisplayCitationTextForTest("Focus [5] [5]. More.")).toBe(
      "Focus [5]. More.",
    );
  });
});
