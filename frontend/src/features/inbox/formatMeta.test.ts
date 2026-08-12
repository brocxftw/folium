import { describe, expect, it } from "vitest";
import type { Document } from "@/lib/api/types";
import { folderDisplayLabel, isSystemInboxPath } from "./formatMeta";

describe("isSystemInboxPath", () => {
  it("treats Documents / Inbox as the system inbox", () => {
    expect(isSystemInboxPath("Documents / Inbox")).toBe(true);
    expect(isSystemInboxPath("documents/inbox")).toBe(true);
    expect(isSystemInboxPath("Inbox")).toBe(true);
    expect(isSystemInboxPath("Finance / Inbox")).toBe(true);
  });

  it("does not treat library folders as inbox", () => {
    expect(isSystemInboxPath("Finance / Salary")).toBe(false);
    expect(isSystemInboxPath("ID / Personal Documents")).toBe(false);
  });
});

describe("folderDisplayLabel", () => {
  it("hides the current Inbox location so AI destinations can show", () => {
    const doc = {
      folder_path: "Documents / Inbox",
      pending_folder_path: null,
    } as Document;
    expect(folderDisplayLabel(doc)).toBe("—");
  });

  it("shows a pending filing path", () => {
    const doc = {
      folder_path: "Documents / Inbox",
      pending_folder_path: "ID / Personal Documents / IC",
    } as Document;
    expect(folderDisplayLabel(doc)).toBe("+ New: ID / Personal Documents / IC");
  });
});
