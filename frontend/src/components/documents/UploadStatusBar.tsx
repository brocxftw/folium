import type { UploadBatchSummary } from "@/lib/api/upload";
import { Button } from "@/components/ui/Button";

interface UploadStatusBarProps {
  busy: boolean;
  progress: { done: number; total: number } | null;
  summary: UploadBatchSummary | null;
  onDismiss: () => void;
}

export function UploadStatusBar({
  busy,
  progress,
  summary,
  onDismiss,
}: UploadStatusBarProps) {
  if (!busy && !summary) return null;

  return (
    <div className="border-b border-surface-border bg-surface-muted px-4 py-2 text-xs text-text-secondary flex items-center gap-3">
      {busy && progress && (
        <span>
          Uploading {progress.done} / {progress.total}…
        </span>
      )}
      {!busy && summary && (
        <>
          <span>
            Uploaded {summary.created} file{summary.created === 1 ? "" : "s"}
            {summary.duplicates > 0 && (
              <> · skipped {summary.duplicates} duplicate{summary.duplicates === 1 ? "" : "s"}</>
            )}
            {summary.failed > 0 && (
              <> · {summary.failed} failed</>
            )}
          </span>
          {summary.errors[0] && (
            <span className="text-danger truncate max-w-md" title={summary.errors.join("\n")}>
              {summary.errors[0]}
            </span>
          )}
          <Button variant="ghost" size="sm" className="ml-auto h-6" onClick={onDismiss}>
            Dismiss
          </Button>
        </>
      )}
    </div>
  );
}
