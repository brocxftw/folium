import { api } from "@/lib/api/client";

export type ShareDocumentInput = {
  id: string;
  title?: string | null;
  original_filename: string;
  mime_type?: string | null;
};

export type ShareDocumentResult =
  | { outcome: "shared" }
  | { outcome: "downloaded" }
  | { outcome: "cancelled" }
  | { outcome: "error"; message: string };

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the click has been processed.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function canShareFiles(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  if (typeof navigator.canShare !== "function") {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Fetch the owned original blob and hand it to the OS/browser share sheet when
 * supported; otherwise fall back to downloading the file.
 */
export async function shareDocument(
  doc: ShareDocumentInput,
): Promise<ShareDocumentResult> {
  const filename = doc.original_filename || "document";
  let blob: Blob;
  try {
    const response = await fetch(api.downloadUrl(doc.id), {
      credentials: "include",
    });
    if (!response.ok) {
      const message = `Failed to fetch document (${response.status})`;
      console.warn(message);
      return { outcome: "error", message };
    }
    blob = await response.blob();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch document";
    console.warn(message, err);
    return { outcome: "error", message };
  }

  const mime = doc.mime_type || blob.type || "application/octet-stream";
  const file = new File([blob], filename, { type: mime });

  if (canShareFiles(file)) {
    try {
      await navigator.share({
        title: doc.title || filename,
        files: [file],
      });
      return { outcome: "shared" };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { outcome: "cancelled" };
      }
      // Share failed after canShare succeeded (size limits, etc.) — fall back.
      console.warn("Native share failed; falling back to download", err);
    }
  }

  try {
    triggerDownload(blob, filename);
    return { outcome: "downloaded" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to download document";
    console.warn(message, err);
    return { outcome: "error", message };
  }
}
