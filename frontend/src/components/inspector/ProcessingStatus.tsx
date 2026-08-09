import { Check, Circle, X } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import type { Document } from "@/lib/api/types";

interface ProcessingStatusProps {
  document: Document;
}

function StatusItem({
  label,
  done,
  date,
  error,
}: {
  label: string;
  done: boolean;
  date?: string | null;
  error?: string | null;
}) {
  return (
    <div className="flex items-start gap-2 py-1">
      {error ? (
        <X className="h-3.5 w-3.5 shrink-0 text-danger mt-0.5" />
      ) : done ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-accent mt-0.5" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0 text-text-muted mt-0.5" />
      )}
      <div className="min-w-0">
        <p className={cn("text-[13px]", done ? "text-text-primary" : "text-text-secondary")}>
          {label}
        </p>
        {date && done && (
          <p className="text-[11px] text-text-muted">{formatDateTime(date)}</p>
        )}
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    </div>
  );
}

export function ProcessingStatus({ document }: ProcessingStatusProps) {
  return (
    <div className="space-y-0.5">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-muted mb-2">
        Processing
      </h4>
      <StatusItem label="OCR completed" done={document.ocr_completed} />
      <StatusItem label="Text extracted" done={document.text_extracted} />
      <StatusItem
        label="Document indexed"
        done={document.document_indexed}
        date={document.indexed_at}
      />
      {document.has_embeddings && (
        <StatusItem label="Embeddings generated" done={true} />
      )}
      {document.processing_error && (
        <StatusItem
          label="Processing error"
          done={false}
          error={document.processing_error}
        />
      )}
      {document.processing_status === "processing" && (
        <p className="text-[11px] text-warning mt-1">Processing in progress…</p>
      )}
    </div>
  );
}
