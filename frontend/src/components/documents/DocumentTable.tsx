import { FileText } from "lucide-react";
import type { Document } from "@/lib/api/types";
import { DocumentRow } from "./DocumentRow";
import { Checkbox } from "@/components/ui/Checkbox";

interface DocumentTableProps {
  documents: Document[];
  selectedIds: Set<string>;
  activeId?: string;
  onSelect: (ids: Set<string>) => void;
  onActiveChange: (id: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DocumentTable({
  documents,
  selectedIds,
  activeId,
  onSelect,
  onActiveChange,
  isLoading,
  emptyMessage = "No documents in this folder",
}: DocumentTableProps) {
  const allSelected = documents.length > 0 && documents.every((d) => selectedIds.has(d.id));
  const someSelected = documents.some((d) => selectedIds.has(d.id));

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
            <th className="hidden xl:table-cell px-2 py-2">Type</th>
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
  );
}
