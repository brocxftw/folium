import type { Document } from "@/lib/api/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10_240 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10_485_760 ? 1 : 0)} MB`;
}

function mimeLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return mime.slice(6).toUpperCase() || "Image";
  if (mime.startsWith("text/")) return "Text";
  return mime.split("/").pop()?.toUpperCase() || "File";
}

export function documentSecondaryMeta(doc: Document): string {
  const parts = [mimeLabel(doc.mime_type)];
  if (doc.page_count != null && doc.page_count > 0) {
    parts.push(`${doc.page_count} page${doc.page_count === 1 ? "" : "s"}`);
  }
  parts.push(formatBytes(doc.file_size));
  return parts.join(" · ");
}

/** True for Inbox (and Documents/Inbox) regardless of slash spacing. */
export function isSystemInboxPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const normalized = path
    .replace(/\s*\/\s*/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  return (
    normalized === "inbox" ||
    normalized === "documents/inbox" ||
    normalized.endsWith("/inbox")
  );
}

export function folderDisplayLabel(doc: Document): string {
  if (doc.pending_folder_path) {
    return `+ New: ${doc.pending_folder_path}`;
  }
  const path = doc.folder_path;
  if (!path || isSystemInboxPath(path)) return "—";
  return path;
}
