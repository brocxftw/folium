import { useState } from "react";
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

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId?: string;
  onSelect: (folderId: string) => void;
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
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  selectedFolderId?: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedFolderId === node.id;
  const isSystem = node.kind !== "normal";

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
            onDelete={onDelete}
          />
        ))}
      </>
    );
  }

  if (node.kind === "inbox" || node.kind === "trash") {
    return null;
  }

  return (
    <div>
      <div
        className={cn(
          "group flex items-center rounded-md pr-1",
          isSelected && "bg-sidebar-active",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => (hasChildren ? onToggle(node.id) : onSelect(node.id))}
          className="flex h-7 w-5 shrink-0 items-center justify-center text-sidebar-muted hover:text-sidebar-text"
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
            "flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[13px] text-sidebar-text",
            "hover:text-white",
          )}
        >
          <FolderIcon className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" />
          <span className="truncate">{node.name}</span>
          {node.document_count > 0 && (
            <span className="ml-auto shrink-0 text-xs text-sidebar-muted">
              {node.document_count}
            </span>
          )}
        </button>
        {!isSystem && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text group-hover:flex"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onCreateChild(node.id)}>
                New subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(node)}>Rename</DropdownMenuItem>
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
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({ folders, selectedFolderId, onSelect }: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<
    | { type: "create"; parentId: string }
    | { type: "rename"; folder: Folder }
    | { type: "delete"; folder: Folder }
    | null
  >(null);
  const [name, setName] = useState("");

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const trashFolder = useTrashFolder();
  const { data: trashCount } = useTrashCount();
  const retentionDays = trashCount?.retention_days ?? 30;

  const tree = buildTree(folders);

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
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-sidebar-muted">
          Folders
        </span>
        <button
          type="button"
          onClick={() => {
            const root = folders.find((f) => f.kind === "root");
            openCreate(root?.id ?? "");
          }}
          className="rounded p-0.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
          title="New folder"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
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
            onDelete={(folder) => setDialog({ type: "delete", folder })}
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
    </div>
  );
}
