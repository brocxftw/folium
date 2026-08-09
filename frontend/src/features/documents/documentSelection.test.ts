import { describe, expect, it } from "vitest";
import {
  isEditableKeyboardTarget,
  selectAllIds,
  selectRangeIds,
  toggleIdInSet,
} from "./documentSelection";

describe("documentSelection", () => {
  it("toggles ids in a set", () => {
    const base = new Set(["a"]);
    expect([...toggleIdInSet(base, "b", true)].sort()).toEqual(["a", "b"]);
    expect([...toggleIdInSet(base, "a", false)]).toEqual([]);
  });

  it("selects inclusive ranges", () => {
    expect([...selectRangeIds(["a", "b", "c", "d"], 1, 3)]).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect([...selectRangeIds(["a", "b", "c"], 2, 0)]).toEqual(["a", "b", "c"]);
  });

  it("selects all ids", () => {
    expect([...selectAllIds(["x", "y"])]).toEqual(["x", "y"]);
  });

  it("detects editable keyboard targets", () => {
    const input = document.createElement("input");
    expect(isEditableKeyboardTarget(input)).toBe(true);
    const div = document.createElement("div");
    expect(isEditableKeyboardTarget(div)).toBe(false);
  });
});
