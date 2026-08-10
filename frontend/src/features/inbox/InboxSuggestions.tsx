import { Check, X } from "lucide-react";
import type { Suggestion } from "@/lib/api/types";
import {
  useAcceptSuggestion,
  useDocumentSuggestions,
  useRejectSuggestion,
} from "@/lib/api/hooks";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function formatSuggestionLabel(s: Suggestion): string {
  const v = s.value;
  if (s.field === "folder") {
    const path = typeof v.path === "string" ? v.path : "—";
    const create = v.create === true;
    return create ? `Create folder: ${path}` : `Move to: ${path}`;
  }
  if (s.field === "tags") {
    const names = Array.isArray(v.tag_names)
      ? v.tag_names.filter((n): n is string => typeof n === "string")
      : [];
    return names.length ? names.join(", ") : "Tags";
  }
  if (s.field === "title" && typeof v.title === "string") {
    return v.title;
  }
  if (s.field === "document_type" && typeof v.name === "string") {
    return v.name;
  }
  if (s.field === "correspondent" && typeof v.name === "string") {
    return v.name;
  }
  return s.field;
}

interface SuggestionChipProps {
  suggestion: Suggestion;
  stopPropagation?: boolean;
  className?: string;
  compact?: boolean;
}

/** Single pending AI suggestion with accept / reject. */
export function SuggestionChip({
  suggestion,
  stopPropagation,
  className,
  compact,
}: SuggestionChipProps) {
  const accept = useAcceptSuggestion();
  const reject = useRejectSuggestion();
  const busy = accept.isPending || reject.isPending;

  return (
    <div
      className={cn(
        "flex items-start gap-1 rounded-md border border-emerald-200/80 bg-emerald-50/70 px-1.5 py-1",
        className,
      )}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
      }}
    >
      <p
        className={cn(
          "min-w-0 flex-1 leading-snug text-emerald-950",
          compact ? "text-[11px]" : "text-xs",
        )}
        title={formatSuggestionLabel(suggestion)}
      >
        <span className="mr-1 font-medium text-emerald-800/80">AI</span>
        {formatSuggestionLabel(suggestion)}
      </p>
      <div className="flex shrink-0 gap-0.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-emerald-800 hover:bg-emerald-100"
          disabled={busy}
          aria-label={`Accept ${suggestion.field}`}
          onClick={() => accept.mutate(suggestion.id)}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-text-muted hover:bg-surface-hover"
          disabled={busy}
          aria-label={`Reject ${suggestion.field}`}
          onClick={() => reject.mutate(suggestion.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

interface InboxSuggestionsProps {
  documentId: string;
  /** When provided, skip the per-document fetch (table/page prefetch). */
  suggestions?: Suggestion[];
  className?: string;
  /** Show a muted empty state instead of rendering nothing. */
  showEmpty?: boolean;
  /** Section label; pass empty string to hide. */
  title?: string;
}

/** Preview sidebar list of pending AI suggestions. */
export function InboxSuggestions({
  documentId,
  suggestions: provided,
  className,
  showEmpty = false,
  title = "AI suggestions",
}: InboxSuggestionsProps) {
  const { data: fetched = [], isLoading } = useDocumentSuggestions(
    provided === undefined ? documentId : undefined,
  );
  const rows = (provided ?? fetched).filter((s) => s.document_id === documentId);

  if (provided === undefined && isLoading && rows.length === 0) {
    return (
      <p className={cn("text-xs text-text-muted", className)}>Checking AI suggestions…</p>
    );
  }

  if (rows.length === 0) {
    if (!showEmpty) return null;
    return (
      <p className={cn("text-xs text-text-muted", className)}>No pending suggestions.</p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {title ? (
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
          {title}
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {rows.map((s) => (
          <li key={s.id}>
            <SuggestionChip suggestion={s} />
          </li>
        ))}
      </ul>
    </div>
  );
}
