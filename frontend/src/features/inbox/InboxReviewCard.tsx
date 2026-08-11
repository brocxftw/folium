import { useState } from "react";
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Eye,
  File,
  FileImage,
  FileText,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { Document, Suggestion } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { InboxStatusBadge } from "./InboxStatusBadge";
import { InboxAiSuggestionPanel } from "./InboxAiSuggestionPanel";
import { documentSecondaryMeta } from "./formatMeta";

function FileIcon({ doc }: { doc: Document }) {
  const mime = doc.mime_type;
  const className = "h-5 w-5 text-[#5D6B76]";
  if (mime === "application/pdf" || mime.startsWith("text/")) {
    return <FileText className={className} strokeWidth={1.75} />;
  }
  if (mime.startsWith("image/")) {
    return <FileImage className={className} strokeWidth={1.75} />;
  }
  return <File className={className} strokeWidth={1.75} />;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  needs_review: "border-[#EFC66A] bg-[#FFF4D8] text-[#B26A00]",
  ready: "border-[#B9E3CC] bg-[#E8F7EF] text-[#198754]",
  preparing: "border-[#C9DDF7] bg-[#EAF3FE] text-[#2D6DB5]",
  failed: "border-[#F3C2C5] bg-[#FDEBEC] text-[#C6474A]",
};

interface InboxReviewCardProps {
  document: Document;
  suggestions: Suggestion[];
  selected: boolean;
  expanded: boolean;
  /** AI suggestion panel is available only after every inbox file has finished preparing. */
  reviewReady?: boolean;
  acceptSuggestionsBusy?: boolean;
  onToggleExpand: () => void;
  onSelect: (selected: boolean) => void;
  onPreview: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onAcceptAllSuggestions?: () => void;
}

export function InboxReviewCard({
  document: doc,
  suggestions,
  selected,
  expanded,
  reviewReady = true,
  acceptSuggestionsBusy = false,
  onToggleExpand,
  onSelect,
  onPreview,
  onRetry,
  onRemove,
  onAcceptAllSuggestions,
}: InboxReviewCardProps) {
  const status = doc.inbox_status;
  const [hover, setHover] = useState(false);
  const pendingCount = suggestions.length;
  const showSuggestions = reviewReady && expanded;

  return (
    <div
      className={cn(
        "mb-3.5 rounded-xl border bg-white p-5 shadow-[0_2px_6px_rgba(20,33,43,0.04)] transition-colors",
        hover ? "border-[#C7D4DA]" : "border-[#DCE3E8]",
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-start gap-3.5">
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onSelect(v === true)}
          aria-label={`Select ${doc.original_filename}`}
          className="mt-3"
        />
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg bg-[#F8FAFB]">
          <FileIcon doc={doc} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[17px] font-bold leading-snug text-[#14212B]">
              {doc.original_filename}
            </h3>
            <InboxStatusBadge
              status={status}
              error={doc.processing_error}
              className={cn(
                "h-[26px] rounded-md px-2.5 text-[11px] font-semibold",
                status ? STATUS_BADGE_CLASS[status] : undefined,
              )}
            />
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-[#74828D]">
            {documentSecondaryMeta(doc)}
          </p>
        </div>
      </div>

      {showSuggestions && (
        <InboxAiSuggestionPanel document={doc} suggestions={suggestions} />
      )}

      <div
        className={cn(
          "mt-4 flex flex-wrap items-center justify-between gap-3",
          "md:ml-[66px]",
        )}
      >
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium",
            reviewReady
              ? "text-[#087F78] hover:underline"
              : "cursor-not-allowed text-[#74828D]",
          )}
          disabled={!reviewReady}
          onClick={onToggleExpand}
        >
          {!reviewReady ? (
            <>Waiting for processing…</>
          ) : expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Collapse
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Expand review
            </>
          )}
        </button>

        <div className="flex items-center gap-2.5">
          {reviewReady && onAcceptAllSuggestions && pendingCount > 0 && (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-[#BFE9E2] px-3.5 font-semibold text-[#087F78]"
              disabled={acceptSuggestionsBusy}
              onClick={onAcceptAllSuggestions}
            >
              <CheckCheck className="h-4 w-4" strokeWidth={1.75} />
              Accept AI suggestions
              {pendingCount > 1 ? ` (${pendingCount})` : ""}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg border-[#DCE3E8] px-3.5 font-semibold text-[#24333D]"
            onClick={onPreview}
          >
            <Eye className="h-4 w-4" strokeWidth={1.75} />
            Preview document
          </Button>
          {status === "failed" && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-lg border-[#DCE3E8] text-[#5D6B76]"
              aria-label="Retry"
              onClick={onRetry}
            >
              <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-lg border-[#DCE3E8] text-[#C6474A] hover:bg-[#FDEBEC]"
            aria-label="Remove from queue"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>
    </div>
  );
}
