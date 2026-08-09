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

export function folderDisplayLabel(doc: Document): string {
  if (doc.pending_folder_path) {
    return `+ New: ${doc.pending_folder_path}`;
  }
  const path = doc.folder_path;
  if (!path) return "—";
  // Hide system Inbox path as unassigned
  if (/\/inbox$/i.test(path) || path.toLowerCase() === "inbox") return "—";
  return path;
}
