import { FileText } from "lucide-react";
import type { DragEvent } from "react";
import { api } from "@/lib/api/client";
import { cn, formatDate } from "@/lib/utils";
import type { Document } from "@/lib/api/types";
import { Checkbox } from "@/components/ui/Checkbox";
import { RetrievalReadinessBadge } from "./RetrievalReadinessBadge";
import { setDocumentDragData, clearDocumentDragData } from "./documentDrag";

interface DocumentCardProps {
  document: Document;
  selected: boolean;
  active: boolean;
  focused: boolean;
  selectedIds: Set<string>;
  onOpen: (id: string) => void;
  onPointerSelect: (
    event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  ) => void;
  onCheckbox: (checked: boolean) => void;
  onFocus: () => void;
}

export function DocumentCard({
  document,
  selected,
  active,
  focused,
  selectedIds,
  onOpen,
  onPointerSelect,
  onCheckbox,
  onFocus,
}: DocumentCardProps) {
  const handleDragStart = (event: DragEvent) => {
    const ids = selectedIds.has(document.id)
      ? Array.from(selectedIds)
      : [document.id];
    setDocumentDragData(event.dataTransfer, ids);
  };

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => clearDocumentDragData()}
      onFocus={onFocus}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-card-checkbox]")) return;
        onPointerSelect({
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
        });
      }}
      onDoubleClick={() => onOpen(document.id)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-md border bg-surface text-left outline-none transition-colors",
        active
          ? "border-accent ring-1 ring-accent"
          : selected
            ? "border-accent/40 bg-row-selected/40"
            : "border-surface-border hover:border-accent/40 hover:bg-surface-hover",
        focused && "ring-2 ring-focus ring-offset-1",
      )}
    >
      <div
        data-card-checkbox
        className="absolute left-2 top-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(c) => onCheckbox(!!c)}
          aria-label={`Select ${document.title}`}
        />
      </div>
      <div className="flex aspect-[4/3] items-center justify-center bg-surface-muted">
        {document.has_thumbnail ? (
          <img
            src={api.thumbnailUrl(document.id)}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <FileText className="h-8 w-8 text-text-muted/50" />
        )}
      </div>
      <div className="space-y-1 p-2">
        <p className="truncate text-[13px] font-medium text-text-primary">
          {document.title}
        </p>
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[11px] text-text-muted">
            {formatDate(document.added_date)}
          </span>
          <RetrievalReadinessBadge document={document} className="shrink-0" />
        </div>
      </div>
    </div>
  );
}
