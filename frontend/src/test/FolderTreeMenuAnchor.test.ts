import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("FolderTree overflow menu trigger", () => {
  it("keeps the 3-dot trigger visible while the menu is open", () => {
    const source = readFileSync(
      resolve(__dirname, "../components/folders/FolderTree.tsx"),
      "utf8",
    );
    expect(source).toContain("data-[state=open]:flex");
    expect(source).toContain("group-hover:flex");
  });
});
