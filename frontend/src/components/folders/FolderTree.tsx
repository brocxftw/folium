import { useState, type DragEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Folder } from "@/lib/api/types";
import {
  useCreateFolder,
  useTrashCount,
  useTrashFolder,
  useUpdateFolder,
} from "@/lib/api/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  dataTransferHasDocuments,
  getDocumentDragIds,
  clearDocumentDragData,
} from "@/features/documents/documentDrag";
import {
  MoveToFolderDialog,
  collectFolderAndDescendantIds,
} from "@/components/documents/MoveToFolderDialog";

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId?: string;
  onSelect: (folderId: string) => void;
  /** Visual theme. Default matches the dark AppShell sidebar. */
  variant?: "sidebar" | "surface";
  /** Hide the section header + new-folder control (e.g. when the parent provides its own). */
  hideHeader?: boolean;
  /** Drop documents onto a folder to move them. */
  onDropDocuments?: (folderId: string, documentIds: string[]) => void;
}

interface TreeNode extends Folder {
  children: TreeNode[];
}

function buildTree(folders: Folder[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const f of folders) {
    map.set(f.id, { ...f, children: [] });
  }

  for (const f of folders) {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(node);
    } else if (f.kind === "root" || !f.parent_id) {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);

  return roots;
}

function FolderNode({
  node,
  depth,
  selectedFolderId,
  expanded,
  onToggle,
  onSelect,
  onCreateChild,
  onRename,
  onMove,
  onDelete,
  onDropDocuments,
  variant,
}: {
  node: TreeNode;
  depth: number;
  selectedFolderId?: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onRename: (folder: Folder) => void;
  onMove: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  onDropDocuments?: (folderId: string, documentIds: string[]) => void;
  variant: "sidebar" | "surface";
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedFolderId === node.id;
  const isSystem = node.kind !== "normal";
  const surface = variant === "surface";
  const [dropActive, setDropActive] = useState(false);

  if (node.kind === "root") {
    return (
      <>
        {node.children.map((child) => (
          <FolderNode
            key={child.id}
            node={child}
            depth={0}
            selectedFolderId={selectedFolderId}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            onCreateChild={onCreateChild}
            onRename={onRename}
            onMove={onMove}
            onDelete={onDelete}
            onDropDocuments={onDropDocuments}
            variant={variant}
          />
        ))}
      </>
    );
  }

  if (node.kind === "inbox" || node.kind === "trash") {
    return null;
  }

  const canDrop = Boolean(onDropDocuments) && node.kind === "normal";

  const handleDragOver = (event: DragEvent) => {
    if (!canDrop || !dataTransferHasDocuments(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropActive(true);
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!canDrop) return;
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    setDropActive(false);
  };

  const handleDrop = (event: DragEvent) => {
    if (!canDrop) return;
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);
    const ids = getDocumentDragIds(event.dataTransfer);
    clearDocumentDragData();
    if (ids.length === 0) return;
    onDropDocuments?.(node.id, ids);
  };

  return (
    <div>
      <div
        className={cn(
          "group flex items-center rounded-md pr-1",
          isSelected && (surface ? "bg-surface-muted" : "bg-sidebar-active"),
          dropActive && "ring-2 ring-accent bg-accent-muted/40",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          type="button"
          onClick={() => (hasChildren ? onToggle(node.id) : onSelect(node.id))}
          className={cn(
            "flex h-7 w-5 shrink-0 items-center justify-center",
            surface
              ? "text-text-muted hover:text-text-primary"
              : "text-sidebar-muted hover:text-sidebar-text",
          )}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[13px]",
            surface
              ? "text-text-primary hover:text-text-primary"
              : "text-sidebar-text hover:text-white",
          )}
        >
          <FolderIcon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              surface ? "text-text-muted" : "text-sidebar-muted",
            )}
          />
          <span className="truncate">{node.name}</span>
          {node.document_count > 0 && (
            <span
              className={cn(
                "ml-auto shrink-0 text-xs",
                surface ? "text-text-muted" : "text-sidebar-muted",
              )}
            >
              {node.document_count}
            </span>
          )}
        </button>
        {!isSystem && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "hidden h-6 w-6 shrink-0 items-center justify-center rounded group-hover:flex",
                  surface
                    ? "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                    : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text",
                )}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onCreateChild(node.id)}>
                New subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(node)}>Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(node)}>Move…</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger"
                onClick={() => onDelete(node)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <FolderNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
              onDropDocuments={onDropDocuments}
              variant={variant}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({
  folders,
  selectedFolderId,
  onSelect,
  variant = "sidebar",
  hideHeader = false,
  onDropDocuments,
}: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<
    | { type: "create"; parentId: string }
    | { type: "rename"; folder: Folder }
    | { type: "delete"; folder: Folder }
    | null
  >(null);
  const [moveFolder, setMoveFolder] = useState<Folder | null>(null);
  const [name, setName] = useState("");

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const trashFolder = useTrashFolder();
  const { data: trashCount } = useTrashCount();
  const retentionDays = trashCount?.retention_days ?? 30;
  const surface = variant === "surface";

  const tree = buildTree(folders);
  const moveExcludeIds = moveFolder
    ? collectFolderAndDescendantIds(folders, moveFolder.id)
    : undefined;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = (parentId: string) => {
    const root = folders.find((f) => f.kind === "root");
    setName("");
    setDialog({ type: "create", parentId: parentId || root?.id || "" });
  };

  const handleSubmit = async () => {
    if (!dialog) return;
    if (dialog.type === "delete") {
      await trashFolder.mutateAsync(dialog.folder.id);
      setDialog(null);
      setName("");
      return;
    }
    if (!name.trim()) return;
    if (dialog.type === "create") {
      await createFolder.mutateAsync({ name: name.trim(), parent_id: dialog.parentId });
    } else if (dialog.type === "rename") {
      await updateFolder.mutateAsync({ id: dialog.folder.id, data: { name: name.trim() } });
    }
    setDialog(null);
    setName("");
  };

  return (
    <div className="space-y-1">
      {!hideHeader && (
        <div className="flex items-center justify-between px-3 py-1">
          <span
            className={cn(
              "text-[11px] font-medium uppercase tracking-wide",
              surface ? "text-text-muted" : "text-sidebar-muted",
            )}
          >
            Folders
          </span>
          <button
            type="button"
            onClick={() => {
              const root = folders.find((f) => f.kind === "root");
              openCreate(root?.id ?? "");
            }}
            className={cn(
              "rounded p-0.5",
              surface
                ? "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text",
            )}
            title="New folder"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="px-1">
        {tree.map((node) => (
          <FolderNode
            key={node.id}
            node={node}
            depth={0}
            selectedFolderId={selectedFolderId}
            expanded={expanded}
            onToggle={toggle}
            onSelect={onSelect}
            onCreateChild={openCreate}
            onRename={(folder) => {
              setName(folder.name);
              setDialog({ type: "rename", folder });
            }}
            onMove={(folder) => setMoveFolder(folder)}
            onDelete={(folder) => setDialog({ type: "delete", folder })}
            onDropDocuments={onDropDocuments}
            variant={variant}
          />
        ))}
      </div>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === "create" && "New folder"}
              {dialog?.type === "rename" && "Rename folder"}
              {dialog?.type === "delete" && "Delete folder"}
            </DialogTitle>
          </DialogHeader>
          {dialog?.type === "delete" ? (
            <p className="text-sm text-text-secondary">
              Move &ldquo;{dialog.folder.name}&rdquo; and its contents to Trash? Items are kept for{" "}
              {retentionDays} days, then permanently deleted.
            </p>
          ) : (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={dialog?.type === "delete" ? "danger" : "default"}
              onClick={handleSubmit}
              disabled={dialog?.type !== "delete" && !name.trim()}
            >
              {dialog?.type === "delete" ? "Move to Trash" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveToFolderDialog
        open={!!moveFolder}
        onOpenChange={(open) => !open && setMoveFolder(null)}
        folders={folders}
        selectedCount={1}
        title="Move folder"
        description={
          moveFolder
            ? `Choose a new parent for “${moveFolder.name}”.`
            : "Choose a new parent folder."
        }
        excludeFolderIds={moveExcludeIds}
        allowRoot
        confirmLabel="Move folder"
        isPending={updateFolder.isPending}
        onConfirm={async (parentId) => {
          if (!moveFolder) return;
          await updateFolder.mutateAsync({
            id: moveFolder.id,
            data: { parent_id: parentId },
          });
          setMoveFolder(null);
        }}
      />
    </div>
  );
}
