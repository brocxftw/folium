import { describe, expect, it } from "vitest";
import {
  formatUploadToast,
  parseSessionRejections,
} from "@/features/inbox/sessionRejections";

describe("sessionRejections", () => {
  it("parses upload error strings into session rows", () => {
    const rows = parseSessionRejections({
      created: 1,
      duplicates: 0,
      failed: 2,
      total: 3,
      errors: ["bad.exe: Unsupported MIME type: application/x-msdownload", "notes.csv: Unsupported MIME type: text/csv"],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].filename).toBe("bad.exe");
    expect(rows[0].message).toContain("Unsupported MIME");
    expect(rows[1].filename).toBe("notes.csv");
  });

  it("formats toast omitting zero parts", () => {
    expect(
      formatUploadToast({
        created: 2,
        duplicates: 0,
        failed: 1,
        total: 3,
        errors: ["x: fail"],
      }),
    ).toBe("Uploaded 2 files · rejected 1");
    expect(
      formatUploadToast({
        created: 0,
        duplicates: 1,
        failed: 0,
        total: 1,
        errors: [],
      }),
    ).toBe("skipped 1 duplicate");
  });
});
