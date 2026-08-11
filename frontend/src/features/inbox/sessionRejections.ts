import type { UploadBatchSummary } from "@/lib/api/upload";

export interface SessionRejection {
  id: string;
  filename: string;
  message: string;
}

let rejectionSeq = 0;

export function parseSessionRejections(summary: UploadBatchSummary): SessionRejection[] {
  return summary.errors.map((raw) => {
    const sep = raw.indexOf(": ");
    const filename = sep >= 0 ? raw.slice(0, sep) : raw;
    const message = sep >= 0 ? raw.slice(sep + 2) : "Upload failed";
    rejectionSeq += 1;
    return {
      id: `reject-${Date.now()}-${rejectionSeq}`,
      filename,
      message,
    };
  });
}

export function formatUploadToast(summary: UploadBatchSummary): string {
  const parts: string[] = [];
  if (summary.created > 0) {
    parts.push(`Uploaded ${summary.created} file${summary.created === 1 ? "" : "s"}`);
  }
  if (summary.failed > 0) {
    parts.push(`rejected ${summary.failed}`);
  }
  if (summary.duplicates > 0) {
    parts.push(
      `skipped ${summary.duplicates} duplicate${summary.duplicates === 1 ? "" : "s"}`,
    );
  }
  if (parts.length === 0) {
    return summary.total === 0 ? "No files uploaded" : "Upload finished";
  }
  return parts.join(" · ");
}
