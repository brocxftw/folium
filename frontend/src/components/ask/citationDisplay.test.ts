import { describe, expect, it } from "vitest";

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
});
