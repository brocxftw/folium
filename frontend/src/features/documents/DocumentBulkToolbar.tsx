import { useState } from "react";
import { ArrowUpDown, FolderInput, Sparkles, Tag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { MoveToFolderDialog } from "@/components/documents/MoveToFolderDialog";
import { useFolders, useTags } from "@/lib/api/hooks";
import type { BulkAction, Folder, Tag as TagType } from "@/lib/api/types";
import type { LibraryOrder, LibrarySort } from "./useDocumentsLibraryState";

export interface BulkActionOptions {
  folder_id?: string;
  tag_ids?: string[];
}

const SORT_OPTIONS: { value: LibrarySort; label: string }[] = [
  { value: "added_date", label: "Date added" },
  { value: "modified_date", label: "Modified" },
  { value: "title", label: "Title" },
  { value: "created_date", label: "Created date" },
];

interface DocumentResultsToolbarProps {
  total: number;
  page: number;
  pageSize: number;
  sort: LibrarySort;
  order: LibraryOrder;
  onSortChange: (sort: LibrarySort, order: LibraryOrder) => void;
  filterChips?: Array<{ id: string; label: string; onClear: () => void }>;
}

export function DocumentResultsToolbar({
  total,
  page,
  pageSize,
  sort,
  order,
  onSortChange,
  filterChips = [],
}: DocumentResultsToolbarProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-1">
      <span className="text-xs text-text-secondary">
        {total === 0 ? "No documents" : `${from}–${to} of ${total}`}
      </span>

      {filterChips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onClear}
          className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[11px] text-text-secondary hover:bg-surface-hover"
        >
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort"}
              {order === "desc" ? " ↓" : " ↑"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() =>
                  onSortChange(
                    opt.value,
                    sort === opt.value && order === "desc" ? "asc" : "desc",
                  )
                }
              >
                {opt.label}
                {sort === opt.value && (order === "desc" ? " ↓" : " ↑")}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface DocumentBulkToolbarProps {
  selectedCount: number;
  onClear: () => void;
  onBulkAction: (action: BulkAction, options?: BulkActionOptions) => void | Promise<void>;
  onAsk?: () => void;
  isPending?: boolean;
  folders?: Folder[];
  tags?: TagType[];
}

export function DocumentBulkToolbar({
  selectedCount,
  onClear,
  onBulkAction,
  onAsk,
  isPending,
  folders: foldersProp,
  tags: tagsProp,
}: DocumentBulkToolbarProps) {
  const { data: foldersQuery = [] } = useFolders();
  const { data: tagsQuery = [] } = useTags();
  const folders = foldersProp ?? foldersQuery;
  const tags = tagsProp ?? tagsQuery;
  const [moveOpen, setMoveOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-surface-border bg-surface-muted px-3 py-2">
        <span className="text-xs font-medium text-text-primary">
          {selectedCount} selected
        </span>
        <Button size="sm" variant="secondary" onClick={() => setMoveOpen(true)}>
          <FolderInput className="h-3.5 w-3.5" />
          Move
        </Button>
        <Popover open={tagOpen} onOpenChange={setTagOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="secondary">
              <Tag className="h-3.5 w-3.5" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div className="max-h-48 overflow-y-auto">
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="block w-full truncate rounded px-2 py-1.5 text-left text-xs hover:bg-surface-hover"
                  onClick={() => {
                    void onBulkAction("tag", { tag_ids: [t.id] });
                    setTagOpen(false);
                  }}
                >
                  {t.name}
                </button>
              ))}
              {tags.length === 0 && (
                <p className="px-2 py-2 text-xs text-text-muted">No tags yet</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button size="sm" variant="secondary" onClick={onAsk}>
          <Sparkles className="h-3.5 w-3.5" />
          Ask
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => void onBulkAction("trash")}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Trash
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
          Clear
        </Button>
      </div>

      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        folders={folders}
        selectedCount={selectedCount}
        isPending={isPending}
        onConfirm={(folderId) => onBulkAction("move", { folder_id: folderId })}
      />
    </>
  );
}
