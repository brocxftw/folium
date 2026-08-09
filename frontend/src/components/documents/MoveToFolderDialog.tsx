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

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  selectedCount: number;
  onConfirm: (folderId: string) => void | Promise<void>;
  isPending?: boolean;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  selectedCount,
  onConfirm,
  isPending,
}: MoveToFolderDialogProps) {
  const destinations = useMemo(
    () =>
      folders
        .filter((f) => f.kind !== "root" && f.kind !== "trash")
        .sort((a, b) => a.path_cache.localeCompare(b.path_cache)),
    [folders],
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>
            Organize {selectedCount} selected document{selectedCount === 1 ? "" : "s"} into a
            folder.
          </DialogDescription>
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
                  {folder.path_cache || folder.name}
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
            {isPending ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
