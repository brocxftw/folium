import { FileText } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn, formatDate } from "@/lib/utils";
import type { Document } from "@/lib/api/types";
import { RetrievalReadinessBadge } from "./RetrievalReadinessBadge";

interface RecentDocumentsProps {
  documents: Document[];
  onOpen: (id: string) => void;
  className?: string;
}

export function RecentDocuments({ documents, onOpen, className }: RecentDocumentsProps) {
  if (documents.length === 0) return null;

  return (
    <section className={cn("space-y-2", className)}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">
        Recently added
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {documents.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => onOpen(doc.id)}
            className="group flex flex-col overflow-hidden rounded-md border border-surface-border bg-surface text-left transition-colors hover:border-accent/40 hover:bg-surface-hover"
          >
            <div className="flex aspect-[4/3] items-center justify-center bg-surface-muted">
              {doc.has_thumbnail ? (
                <img
                  src={api.thumbnailUrl(doc.id)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <FileText className="h-8 w-8 text-text-muted/50" />
              )}
            </div>
            <div className="space-y-1 p-2">
              <p className="truncate text-[13px] font-medium text-text-primary group-hover:text-accent">
                {doc.title}
              </p>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[11px] text-text-muted">
                  {formatDate(doc.added_date)}
                </span>
                <RetrievalReadinessBadge document={doc} className="shrink-0" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
