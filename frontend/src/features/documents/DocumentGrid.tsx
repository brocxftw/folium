import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, LayoutGrid, LayoutList } from "lucide-react";
import type { Document } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { DocumentCard } from "./DocumentCard";
import { useDocumentSelectionModel } from "./useDocumentSelectionModel";

/** Approximate column count for keyboard navigation at common breakpoints. */
function useApproxGridColumns(): number {
  // Match Tailwind grid: 2 / sm:3 / lg:4 / xl:5 — approximate via matchMedia.
  const [cols, setCols] = useState(() => {
    if (typeof window === "undefined") return 4;
    if (window.matchMedia("(min-width: 1280px)").matches) return 5;
    if (window.matchMedia("(min-width: 1024px)").matches) return 4;
    if (window.matchMedia("(min-width: 640px)").matches) return 3;
    return 2;
  });

  useEffect(() => {
    const queries = [
      window.matchMedia("(min-width: 1280px)"),
      window.matchMedia("(min-width: 1024px)"),
      window.matchMedia("(min-width: 640px)"),
    ];
    const update = () => {
      if (queries[0].matches) setCols(5);
      else if (queries[1].matches) setCols(4);
      else if (queries[2].matches) setCols(3);
      else setCols(2);
    };
    for (const mq of queries) mq.addEventListener("change", update);
    return () => {
      for (const mq of queries) mq.removeEventListener("change", update);
    };
  }, []);

  return cols;
}

interface DocumentGridProps {
  documents: Document[];
  selectedIds: Set<string>;
  activeId?: string;
  onSelect: (ids: Set<string>) => void;
  onActiveChange: (id: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

export function DocumentGrid({
  documents,
  selectedIds,
  activeId,
  onSelect,
  onActiveChange,
  isLoading,
  emptyMessage = "No documents in this folder",
  page = 1,
  pageSize = 50,
  total,
  onPageChange,
}: DocumentGridProps) {
  const documentIds = useMemo(() => documents.map((d) => d.id), [documents]);
  const gridColumns = useApproxGridColumns();
  const {
    focusedIndex,
    handleItemPointer,
    handleCheckbox,
    handleKeyDown,
  } = useDocumentSelectionModel({
    documentIds,
    selectedIds,
    onSelect,
    onOpen: onActiveChange,
    gridColumns,
  });

  const totalCount = total ?? documents.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
        Loading documents…
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <FileText className="h-10 w-10 text-text-muted/40" />
        <p className="text-sm text-text-secondary">{emptyMessage}</p>
        <p className="text-xs text-text-muted">
          Drop files or folders here — folder structure is preserved
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col outline-none"
      tabIndex={0}
      role="listbox"
      aria-multiselectable
      aria-label="Documents"
      onKeyDown={handleKeyDown}
    >
      <div className="flex-1 overflow-auto p-3 scrollbar-thin">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {documents.map((doc, index) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              selected={selectedIds.has(doc.id)}
              active={activeId === doc.id}
              focused={focusedIndex === index}
              selectedIds={selectedIds}
              onOpen={onActiveChange}
              onPointerSelect={(mods) => {
                const action = handleItemPointer(index, mods);
                if (action === "open") onActiveChange(doc.id);
              }}
              onCheckbox={(checked) => handleCheckbox(index, checked)}
              onFocus={() => undefined}
            />
          ))}
        </div>
      </div>

      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-surface-border px-2 py-2">
          <span className="text-xs text-text-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shared list/grid toggle control for the results toolbar. */
export function DocumentsLayoutToggle({
  mode,
  onChange,
}: {
  mode: "list" | "grid";
  onChange: (mode: "list" | "grid") => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-surface-border p-0.5">
      <Button
        type="button"
        size="icon"
        variant={mode === "list" ? "secondary" : "ghost"}
        className="h-7 w-7"
        aria-label="List layout"
        aria-pressed={mode === "list"}
        onClick={() => onChange("list")}
      >
        <LayoutList className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={mode === "grid" ? "secondary" : "ghost"}
        className="h-7 w-7"
        aria-label="Grid layout"
        aria-pressed={mode === "grid"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
