import { AlertCircle, Clock, FileStack, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FolderTree } from "@/components/folders/FolderTree";
import { SidebarTagList } from "@/components/tags/TagList";
import type { Folder, Tag } from "@/lib/api/types";
import type { LibraryView } from "./useDocumentsLibraryState";

interface DocumentExplorerSidebarProps {
  folders: Folder[];
  tags: Tag[];
  view: LibraryView;
  folderId?: string;
  tagIds: string[];
  onViewChange: (view: LibraryView) => void;
  onFolderSelect: (folderId: string | undefined) => void;
  onTagToggle: (tagId: string) => void;
  onDropDocuments?: (folderId: string, documentIds: string[]) => void;
  className?: string;
}

const QUICK_ACCESS: {
  id: LibraryView;
  label: string;
  icon: typeof FileStack;
}[] = [
  { id: "all", label: "All documents", icon: FileStack },
  { id: "recent", label: "Recently added", icon: Clock },
  { id: "unprocessed", label: "Unprocessed", icon: AlertCircle },
];

export function DocumentExplorerSidebar({
  folders,
  tags,
  view,
  folderId,
  tagIds,
  onViewChange,
  onFolderSelect,
  onTagToggle,
  onDropDocuments,
  className,
}: DocumentExplorerSidebarProps) {
  return (
    <aside
      className={cn(
        "flex w-[220px] shrink-0 flex-col border-r border-surface-border bg-surface overflow-hidden",
        className,
      )}
    >
      <div className="border-b border-surface-border px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Quick access
        </p>
        <ul className="mt-1 space-y-0.5">
          {QUICK_ACCESS.map(({ id, label, icon: Icon }) => {
            const active = view === id && !folderId && tagIds.length === 0;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    onFolderSelect(undefined);
                    onViewChange(id);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]",
                    active
                      ? "bg-surface-muted font-medium text-text-primary"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  <span className="truncate">{label}</span>
                </button>
              </li>
            );
          })}
          <li>
            <Link
              to="/inbox"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            >
              <Inbox className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span className="truncate">Inbox</span>
            </Link>
          </li>
        </ul>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin py-2">
        <FolderTree
          folders={folders}
          selectedFolderId={folderId}
          onSelect={(id) => onFolderSelect(id)}
          onDropDocuments={onDropDocuments}
          variant="surface"
        />
      </div>

      <div className="max-h-[200px] overflow-auto border-t border-surface-border py-2 scrollbar-thin">
        <div className="px-3 py-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Tags
          </span>
        </div>
        <SidebarTagList
          tags={tags}
          selectedTagIds={tagIds}
          onSelect={onTagToggle}
          variant="surface"
        />
      </div>
    </aside>
  );
}
