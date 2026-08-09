import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { Document } from "@/lib/api/types";
import { DocumentRow } from "./DocumentRow";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";

interface DocumentTableProps {
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

export function DocumentTable({
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
}: DocumentTableProps) {
  const allSelected = documents.length > 0 && documents.every((d) => selectedIds.has(d.id));
  const someSelected = documents.some((d) => selectedIds.has(d.id));
  const totalCount = total ?? documents.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const toggleAll = (checked: boolean) => {
    if (checked) {
      onSelect(new Set(documents.map((d) => d.id)));
    } else {
      onSelect(new Set());
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelect(next);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted text-sm">
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
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-muted border-b border-surface-border">
            <tr className="text-left text-xs font-medium text-text-muted uppercase tracking-wide">
              <th className="w-8 px-2 py-2">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as unknown as HTMLInputElement).indeterminate =
                        someSelected && !allSelected;
                    }
                  }}
                  onCheckedChange={(c) => toggleAll(!!c)}
                />
              </th>
              <th className="px-2 py-2">Name</th>
              <th className="hidden lg:table-cell px-2 py-2">Folder</th>
              <th className="hidden md:table-cell px-2 py-2">Tags</th>
              <th className="hidden xl:table-cell px-2 py-2">Pages / size</th>
              <th className="hidden sm:table-cell px-2 py-2">Status</th>
              <th className="w-24 px-2 py-2 text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                selected={selectedIds.has(doc.id)}
                active={activeId === doc.id}
                onSelect={toggleOne}
                onClick={onActiveChange}
              />
            ))}
          </tbody>
        </table>
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
