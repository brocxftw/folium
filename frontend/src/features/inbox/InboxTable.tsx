import { Eye, RotateCcw, Trash2 } from "lucide-react";
import type { Document, InboxStatus, Suggestion } from "@/lib/api/types";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import { InboxStatusBadge } from "./InboxStatusBadge";
import { InboxFolderControl } from "./InboxFolderControl";
import { InboxTagsControl } from "./InboxTagsControl";
import { InboxTypeControl } from "./InboxTypeControl";
import { SuggestionChip } from "./InboxSuggestions";
import { documentSecondaryMeta } from "./formatMeta";

interface InboxTableProps {
  documents: Document[];
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onPreview: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  /** Pending AISuggestions keyed by document id */
  suggestionsByDoc?: Record<string, Suggestion[]>;
  isLoading?: boolean;
  empty?: React.ReactNode;
}

function fieldSuggestion(
  rows: Suggestion[] | undefined,
  field: string,
): Suggestion | undefined {
  return rows?.find((s) => s.field === field);
}

export function InboxTable({
  documents,
  selectedIds,
  onSelect,
  onPreview,
  onRemove,
  onRetry,
  suggestionsByDoc = {},
  isLoading,
  empty,
}: InboxTableProps) {
  const allSelected = documents.length > 0 && documents.every((d) => selectedIds.has(d.id));
  const someSelected = documents.some((d) => selectedIds.has(d.id));

  const toggleAll = () => {
    if (allSelected) onSelect(new Set());
    else onSelect(new Set(documents.map((d) => d.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelect(next);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
        Loading inbox…
      </div>
    );
  }

  if (documents.length === 0) {
    return <div className="flex flex-1 items-center justify-center p-8">{empty}</div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface border-b border-surface-border">
          <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-text-muted">
            <th className="w-10 px-3 py-2">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </th>
            <th className="px-2 py-2 font-medium">Document</th>
            <th className="px-2 py-2 font-medium w-[200px]">Folder</th>
            <th className="px-2 py-2 font-medium w-[200px]">Tags</th>
            <th className="px-2 py-2 font-medium w-[130px]">Type</th>
            <th className="px-2 py-2 font-medium w-[120px]">Status</th>
            <th className="px-2 py-2 font-medium w-[88px]" />
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const status = (doc.inbox_status ?? null) as InboxStatus | null;
            const sug = suggestionsByDoc[doc.id] ?? [];
            const folderSug = fieldSuggestion(sug, "folder");
            const tagsSug = fieldSuggestion(sug, "tags");
            const titleSug = fieldSuggestion(sug, "title");
            const typeSug = fieldSuggestion(sug, "document_type");
            return (
              <tr
                key={doc.id}
                className={cn(
                  "border-b border-surface-border/80 hover:bg-surface-hover/60 cursor-pointer",
                  selectedIds.has(doc.id) && "bg-accent/5",
                )}
                onClick={() => onPreview(doc.id)}
              >
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(doc.id)}
                    onCheckedChange={() => toggleOne(doc.id)}
                    aria-label={`Select ${doc.title}`}
                  />
                </td>
                <td className="px-2 py-2 align-middle min-w-0">
                  <div className="truncate font-medium text-text-primary">
                    {doc.original_filename || doc.title}
                  </div>
                  <div className="truncate text-[11px] text-text-muted">
                    {documentSecondaryMeta(doc)}
                  </div>
                  {titleSug && (
                    <div className="mt-1 max-w-[280px]">
                      <SuggestionChip suggestion={titleSug} stopPropagation compact />
                    </div>
                  )}
                </td>
                <td className="px-2 py-2 align-middle">
                  <div className="space-y-1">
                    {folderSug && !doc.pending_folder_path ? (
                      <SuggestionChip suggestion={folderSug} stopPropagation compact />
                    ) : (
                      <InboxFolderControl document={doc} stopPropagation />
                    )}
                    {folderSug && !doc.pending_folder_path && (
                      <InboxFolderControl document={doc} stopPropagation />
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 align-middle">
                  <div className="space-y-1">
                    <InboxTagsControl document={doc} stopPropagation />
                    {tagsSug && doc.tags.length === 0 && (
                      <SuggestionChip suggestion={tagsSug} stopPropagation compact />
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 align-middle">
                  <div className="space-y-1">
                    <InboxTypeControl document={doc} stopPropagation />
                    {typeSug && !doc.document_type_id && (
                      <SuggestionChip suggestion={typeSug} stopPropagation compact />
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 align-middle">
                  <InboxStatusBadge status={status} error={doc.processing_error} />
                </td>
                <td className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => onPreview(doc.id)}
                          aria-label="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Preview</TooltipContent>
                    </Tooltip>
                    {status === "failed" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => onRetry(doc.id)}
                            aria-label="Retry"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Retry pre-flight</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-text-muted hover:text-danger"
                          onClick={() => onRemove(doc.id)}
                          aria-label="Remove from queue"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove from queue</TooltipContent>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
