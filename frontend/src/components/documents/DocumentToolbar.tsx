import { useState } from "react";
import {
  Download,
  FolderInput,
  FolderUp,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { MoveToFolderDialog } from "@/components/documents/MoveToFolderDialog";
import { useFolders } from "@/lib/api/hooks";
import type { BulkAction } from "@/lib/api/types";

export interface BulkActionOptions {
  folder_id?: string;
  tag_ids?: string[];
}

interface DocumentToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCount: number;
  sort: string;
  order: "asc" | "desc";
  onSortChange: (sort: string, order: "asc" | "desc") => void;
  onRefresh: () => void;
  onUploadFiles: () => void;
  onUploadFolder: () => void;
  onBulkAction: (action: BulkAction, options?: BulkActionOptions) => void | Promise<void>;
  isRefreshing?: boolean;
  isBulkPending?: boolean;
  uploadBusy?: boolean;
}

const SORT_OPTIONS = [
  { value: "added_date", label: "Date added" },
  { value: "modified_date", label: "Modified" },
  { value: "title", label: "Title" },
  { value: "created_date", label: "Created date" },
];

export function DocumentToolbar({
  searchQuery,
  onSearchChange,
  selectedCount,
  sort,
  order,
  onSortChange,
  onRefresh,
  onUploadFiles,
  onUploadFolder,
  onBulkAction,
  isRefreshing,
  isBulkPending,
  uploadBusy,
}: DocumentToolbarProps) {
  const { data: folders = [] } = useFolders();
  const [moveOpen, setMoveOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-surface-border bg-surface px-3 py-2">
      <div className="relative flex-1 min-w-[160px] max-w-xs">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter documents…"
          className="pl-8 h-7"
        />
      </div>

      {selectedCount > 0 && (
        <span className="text-xs text-text-secondary">
          {selectedCount} selected
        </span>
      )}

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          title="Archive"
          disabled={selectedCount === 0}
          onClick={() => void onBulkAction("archive")}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Tag"
          disabled={selectedCount === 0}
          onClick={() => void onBulkAction("tag")}
        >
          <Tag className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Move to folder"
          disabled={selectedCount === 0}
          onClick={() => setMoveOpen(true)}
        >
          <FolderInput className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Trash"
          disabled={selectedCount === 0}
          onClick={() => void onBulkAction("trash")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort"}
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

        <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh">
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1" disabled={uploadBusy}>
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onUploadFiles}>
              <Upload className="h-3.5 w-3.5" />
              Upload files…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onUploadFolder}>
              <FolderUp className="h-3.5 w-3.5" />
              Upload folder…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        folders={folders}
        selectedCount={selectedCount}
        isPending={isBulkPending}
        onConfirm={(folderId) => onBulkAction("move", { folder_id: folderId })}
      />
    </div>
  );
}
