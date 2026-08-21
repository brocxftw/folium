import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shareDocument } from "./shareDocument";

const doc = {
  id: "doc-1",
  title: "Invoice",
  original_filename: "invoice.pdf",
  mime_type: "application/pdf",
};

describe("shareDocument", () => {
  const fetchMock = vi.fn();
  const shareMock = vi.fn();
  const canShareMock = vi.fn();
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["pdf-bytes"], { type: "application/pdf" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    Object.defineProperty(navigator, "share", {
      configurable: true,
      writable: true,
      value: shareMock,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      writable: true,
      value: canShareMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shares via navigator.share when canShare accepts files", async () => {
    canShareMock.mockReturnValue(true);
    shareMock.mockResolvedValue(undefined);

    const result = await shareDocument(doc);

    expect(fetchMock).toHaveBeenCalledWith("/api/documents/doc-1/download", {
      credentials: "include",
    });
    expect(canShareMock).toHaveBeenCalled();
    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Invoice",
        files: [expect.any(File)],
      }),
    );
    expect(result).toEqual({ outcome: "shared" });
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("falls back to download when canShare rejects files", async () => {
    canShareMock.mockReturnValue(false);

    const result = await shareDocument(doc);

    expect(shareMock).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(result).toEqual({ outcome: "downloaded" });
  });

  it("falls back to download when share is unavailable", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const result = await shareDocument(doc);

    expect(result).toEqual({ outcome: "downloaded" });
    expect(clickSpy).toHaveBeenCalled();
  });

  it("treats AbortError as cancelled", async () => {
    canShareMock.mockReturnValue(true);
    shareMock.mockRejectedValue(new DOMException("User cancelled", "AbortError"));

    const result = await shareDocument(doc);

    expect(result).toEqual({ outcome: "cancelled" });
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("returns error when fetch fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const result = await shareDocument(doc);

    expect(result).toEqual({
      outcome: "error",
      message: "Failed to fetch document (404)",
    });
  });

  it("falls back to download when share throws a non-abort error", async () => {
    canShareMock.mockReturnValue(true);
    shareMock.mockRejectedValue(new Error("share failed"));

    const result = await shareDocument(doc);

    expect(result).toEqual({ outcome: "downloaded" });
    expect(clickSpy).toHaveBeenCalled();
  });
});
