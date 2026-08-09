import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/api/types";

interface CitationListProps {
  citations: Citation[];
  onOpen: (citation: Citation) => void;
  className?: string;
}

export function CitationList({ citations, onOpen, className }: CitationListProps) {
  if (citations.length === 0) return null;

  return (
    <div className={className}>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        Sources
      </h3>
      <ul className="space-y-2">
        {citations.map((c, i) => (
          <li key={`${c.chunk_id}-${i}`}>
            <button
              type="button"
              onClick={() => onOpen(c)}
              className={cn(
                "w-full rounded-md border border-surface-border bg-surface p-3 text-left",
                "hover:border-accent/30 hover:bg-surface-hover",
              )}
            >
              <span className="text-[13px] font-medium text-accent">
                {c.title}
                {c.page_number ? ` — page ${c.page_number}` : ""}
              </span>
              {c.quote && (
                <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                  &ldquo;{c.quote}&rdquo;
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
