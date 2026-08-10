import { useMemo, useState } from "react";
import type { Folder } from "@/lib/api/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

/** Collect folder id plus all descendant ids (for move exclusion). */
export function collectFolderAndDescendantIds(
  folders: Folder[],
  folderId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parent_id) continue;
    const list = childrenByParent.get(f.parent_id) ?? [];
    list.push(f.id);
    childrenByParent.set(f.parent_id, list);
  }
  const excluded = new Set<string>([folderId]);
  const stack = [folderId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const childId of childrenByParent.get(id) ?? []) {
      if (!excluded.has(childId)) {
        excluded.add(childId);
        stack.push(childId);
      }
    }
  }
  return excluded;
}

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  selectedCount: number;
  onConfirm: (folderId: string) => void | Promise<void>;
  isPending?: boolean;
  title?: string;
  description?: string;
  /** Folder ids that cannot be chosen as destination (e.g. self + descendants). */
  excludeFolderIds?: Iterable<string>;
  /** When true, include the library root as a destination (for reparenting folders). */
  allowRoot?: boolean;
  confirmLabel?: string;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  selectedCount,
  onConfirm,
  isPending,
  title = "Move to folder",
  description,
  excludeFolderIds,
  allowRoot = false,
  confirmLabel = "Move",
}: MoveToFolderDialogProps) {
  const excluded = useMemo(
    () => new Set(excludeFolderIds ?? []),
    [excludeFolderIds],
  );

  const destinations = useMemo(
    () =>
      folders
        .filter((f) => {
          if (excluded.has(f.id)) return false;
          if (f.kind === "trash") return false;
          if (f.kind === "root") return allowRoot;
          if (f.kind === "inbox") return !allowRoot;
          return f.kind === "normal";
        })
        .sort((a, b) => a.path_cache.localeCompare(b.path_cache)),
    [folders, excluded, allowRoot],
  );

  const [folderId, setFolderId] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (!next) setFolderId("");
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!folderId) return;
    await onConfirm(folderId);
    setFolderId("");
    onOpenChange(false);
  };

  const defaultDescription =
    description ??
    `Organize ${selectedCount} selected document${selectedCount === 1 ? "" : "s"} into a folder.`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{defaultDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary" htmlFor="move-folder">
            Destination
          </label>
          <Select value={folderId || undefined} onValueChange={setFolderId}>
            <SelectTrigger id="move-folder">
              <SelectValue placeholder="Select a folder…" />
            </SelectTrigger>
            <SelectContent>
              {destinations.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.kind === "root"
                    ? "Documents (root)"
                    : folder.path_cache || folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {destinations.length === 0 && (
            <p className="text-xs text-text-muted">
              No folders yet. Create one from the sidebar first.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!folderId || isPending}>
            {isPending ? "Moving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
