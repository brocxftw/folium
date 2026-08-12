import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AskCitationSnapshot, Citation } from "@/lib/api/types";

interface InlineCitationProps {
  citation: AskCitationSnapshot | Citation;
  active?: boolean;
  onActivate: (citation: Citation) => void;
}

function toCitation(c: AskCitationSnapshot | Citation): Citation {
  if ("title" in c && typeof (c as Citation).title === "string" && "chunk_id" in c) {
    const snap = c as AskCitationSnapshot;
    return {
      document_id: snap.document_id,
      page_number: snap.page_number,
      chunk_id: snap.chunk_id,
      title: snap.title ?? "Source",
      quote: snap.quote,
      display_number: snap.display_number,
    };
  }
  return c as Citation;
}

export function InlineCitation({ citation, active, onActivate }: InlineCitationProps) {
  const c = toCitation(citation);
  const n = c.display_number ?? 0;
  const label = `Source ${n}${c.title ? `, ${c.title}` : ""}${
    c.page_number != null ? `, page ${c.page_number}` : ""
  }`;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => onActivate(c)}
      className={cn(
        "mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded px-1",
        "align-super text-[11px] font-semibold tabular-nums",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active
          ? "bg-accent text-white"
          : "bg-accent/15 text-accent hover:bg-accent/25",
      )}
    >
      {n}
    </button>
  );
}

interface CitationPreviewPopoverProps {
  citation: Citation;
  onView: () => void;
  onClose: () => void;
}

export function CitationPreviewPopover({
  citation,
  onView,
  onClose,
}: CitationPreviewPopoverProps) {
  const titleId = useId();
  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      className="absolute z-20 w-[min(100%,320px)] rounded-[10px] border border-surface-border bg-surface p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p id={titleId} className="text-xs font-medium text-text-primary">
          [{citation.display_number ?? "?"}] {citation.title}
          {citation.page_number != null ? ` · Page ${citation.page_number}` : ""}
        </p>
        <button
          type="button"
          className="text-xs text-text-muted hover:text-text-primary"
          onClick={onClose}
          aria-label="Close citation preview"
        >
          Esc
        </button>
      </div>
      {citation.quote && (
        <p className="mt-2 line-clamp-5 text-[13px] leading-snug text-text-secondary">
          &ldquo;{citation.quote}&rdquo;
        </p>
      )}
      <button
        type="button"
        className="mt-3 text-xs font-medium text-accent hover:underline"
        onClick={onView}
      >
        View in document
      </button>
    </div>
  );
}

interface SourcesDrawerProps {
  citations: AskCitationSnapshot[] | Citation[];
  activeNumber?: number | null;
  onOpen: (citation: Citation) => void;
  defaultOpen?: boolean;
}

export function SourcesDrawer({
  citations,
  activeNumber,
  onOpen,
  defaultOpen = false,
}: SourcesDrawerProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (citations.length === 0) return null;

  return (
    <div className="mt-2 rounded-[10px] border border-surface-border bg-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-text-secondary hover:bg-surface-hover"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {citations.length} source{citations.length === 1 ? "" : "s"}
        </span>
        <span className="text-text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="space-y-2 border-t border-surface-border px-3 py-2">
          {citations.map((raw, i) => {
            const c = toCitation(raw);
            const n = c.display_number ?? i + 1;
            return (
              <li key={`${c.chunk_id}-${n}`}>
                <button
                  type="button"
                  onClick={() => onOpen({ ...c, display_number: n })}
                  className={cn(
                    "flex w-full gap-2 rounded-md p-2 text-left hover:bg-surface-hover",
                    activeNumber === n && "bg-accent/10",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 min-w-5 items-center justify-center rounded text-[11px] font-semibold",
                      activeNumber === n
                        ? "bg-accent text-white"
                        : "bg-accent/15 text-accent",
                    )}
                  >
                    {n}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-text-primary">
                      {c.title}
                      {c.page_number != null ? ` — page ${c.page_number}` : ""}
                    </span>
                    {c.quote && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-text-secondary">
                        &ldquo;{c.quote}&rdquo;
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const CITATION_TOKEN = /\[(\d+)\]/g;

interface AnswerBodyProps {
  content: string;
  citations: AskCitationSnapshot[] | Citation[];
  activeNumber?: number | null;
  onActivate: (citation: Citation) => void;
}

export function AnswerBody({
  content,
  citations,
  activeNumber,
  onActivate,
}: AnswerBodyProps) {
  const byNumber = new Map<number, Citation>();
  for (const raw of citations) {
    const c = toCitation(raw);
    const n = c.display_number;
    if (n != null) byNumber.set(n, c);
  }

  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(CITATION_TOKEN.source, "g");
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) {
      parts.push(content.slice(last, match.index));
    }
    const n = Number(match[1]);
    const citation = byNumber.get(n);
    if (citation) {
      parts.push(
        <InlineCitation
          key={`${match.index}-${n}`}
          citation={{ ...citation, display_number: n }}
          active={activeNumber === n}
          onActivate={onActivate}
        />,
      );
    } else {
      parts.push(match[0]);
    }
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    parts.push(content.slice(last));
  }

  return (
    <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-text-primary">
      {parts}
    </div>
  );
}

/** Hover preview wrapper for the first hovered inline citation in a message. */
export function useCitationHover() {
  const [hovered, setHovered] = useState<Citation | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return { hovered, setHovered };
}
