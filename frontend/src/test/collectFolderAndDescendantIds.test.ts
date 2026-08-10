import { describe, expect, it } from "vitest";
import { collectFolderAndDescendantIds } from "@/components/documents/MoveToFolderDialog";
import type { Folder } from "@/lib/api/types";

function folder(
  partial: Pick<Folder, "id" | "name" | "parent_id" | "kind">,
): Folder {
  return {
    sort_order: 0,
    path_cache: partial.name,
    created_at: "",
    updated_at: "",
    children_count: 0,
    document_count: 0,
    ...partial,
  };
}

describe("collectFolderAndDescendantIds", () => {
  const folders: Folder[] = [
    folder({ id: "root", name: "Documents", parent_id: null, kind: "root" }),
    folder({ id: "a", name: "A", parent_id: "root", kind: "normal" }),
    folder({ id: "b", name: "B", parent_id: "a", kind: "normal" }),
    folder({ id: "c", name: "C", parent_id: "b", kind: "normal" }),
    folder({ id: "d", name: "D", parent_id: "root", kind: "normal" }),
  ];

  it("includes self and nested descendants", () => {
    expect([...collectFolderAndDescendantIds(folders, "a")].sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("returns only self when folder has no children", () => {
    expect([...collectFolderAndDescendantIds(folders, "d")]).toEqual(["d"]);
  });
});
