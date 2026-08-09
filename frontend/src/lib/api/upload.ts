import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import type { Document, UploadResult } from "@/lib/api/types";
import {
  entriesFromDataTransfer,
  entriesFromFileList,
  isTreeUpload,
  type UploadEntry,
} from "@/lib/uploadTree";

export interface UploadBatchSummary {
  created: number;
  duplicates: number;
  failed: number;
  total: number;
  errors: string[];
}

function emptySummary(total: number): UploadBatchSummary {
  return { created: 0, duplicates: 0, failed: 0, total, errors: [] };
}

function isDuplicateResult(body: Document | UploadResult): body is UploadResult {
  return "status" in body && body.status === "duplicate";
}

async function uploadOne(
  entry: UploadEntry,
  opts: { folderId?: string; skipDuplicates: boolean },
): Promise<"created" | "duplicate"> {
  const form = new FormData();
  form.append("file", entry.file, entry.file.name);
  if (opts.folderId) form.append("folder_id", opts.folderId);
  if (entry.relativePath.includes("/")) {
    form.append("relative_path", entry.relativePath);
  }
  if (opts.skipDuplicates) {
    form.append("on_duplicate", "skip");
  }

  try {
    const result = await api.upload<Document | UploadResult>("/api/documents/upload", form);
    if (isDuplicateResult(result)) return "duplicate";
    return "created";
  } catch (err) {
    if (err instanceof ApiError && err.duplicate) return "duplicate";
    throw err;
  }
}

export function useDocumentUploader() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastSummary, setLastSummary] = useState<UploadBatchSummary | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["documents"] });
    void qc.invalidateQueries({ queryKey: ["folders"] });
  };

  const uploadEntries = async (
    entries: UploadEntry[],
    opts: { folderId?: string } = {},
  ): Promise<UploadBatchSummary> => {
    const skipDuplicates = isTreeUpload(entries) || entries.length > 1;
    const summary = emptySummary(entries.length);
    setBusy(true);
    setProgress({ done: 0, total: entries.length });
    setLastSummary(null);

    try {
      for (let i = 0; i < entries.length; i++) {
        try {
          const status = await uploadOne(entries[i], {
            folderId: opts.folderId,
            skipDuplicates,
          });
          if (status === "created") summary.created += 1;
          else summary.duplicates += 1;
        } catch (err) {
          summary.failed += 1;
          summary.errors.push(
            `${entries[i].relativePath}: ${err instanceof Error ? err.message : "upload failed"}`,
          );
        }
        setProgress({ done: i + 1, total: entries.length });
      }
      invalidate();
      setLastSummary(summary);
      return summary;
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const uploadFileList = (files: FileList | File[], opts?: { folderId?: string }) =>
    uploadEntries(entriesFromFileList(files), opts);

  const uploadDataTransfer = async (
    dataTransfer: DataTransfer,
    opts?: { folderId?: string },
  ) => {
    const entries = await entriesFromDataTransfer(dataTransfer);
    return uploadEntries(entries, opts);
  };

  return {
    busy,
    progress,
    lastSummary,
    clearSummary: () => setLastSummary(null),
    uploadEntries,
    uploadFileList,
    uploadDataTransfer,
  };
}
