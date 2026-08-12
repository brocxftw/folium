import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  useBulkAction,
  useFolders,
  useTags,
  useTrashDocument,
  useUpdateDocumentMetadata,
} from "@/lib/api/hooks";
import type { Document, Folder, Tag as TagType } from "@/lib/api/types";
import { MoveToFolderDialog } from "@/components/documents/MoveToFolderDialog";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type DialogKind = "rename" | "tags" | "trash" | null;

interface DocumentActionsMenuProps {
  document: Document;
  folders?: Folder[];
  tags?: TagType[];
  className?: string;
  triggerClassName?: string;
  /** Always show the trigger (not only on row/card hover). */
  alwaysVisible?: boolean;
  onActionComplete?: () => void;
}

export function DocumentActionsMenu({
  document: doc,
  folders: foldersProp,
  tags: tagsProp,
  className,
  triggerClassName,
  alwaysVisible = false,
  onActionComplete,
}: DocumentActionsMenuProps) {
  const { data: foldersQuery = [] } = useFolders();
  const { data: tagsQuery = [] } = useTags();
  const folders = foldersProp ?? foldersQuery;
  const tags = tagsProp ?? tagsQuery;

  const updateMetadata = useUpdateDocumentMetadata();
  const trashDocument = useTrashDocument();
  const bulkAction = useBulkAction();

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [title, setTitle] = useState(doc.title);
  const [busy, setBusy] = useState(false);

  const openRename = () => {
    setTitle(doc.title || doc.original_filename || "");
    setDialog("rename");
  };

  const handleRename = async () => {
    const next = title.trim();
    if (!next || next === doc.title) {
      setDialog(null);
      return;
    }
    setBusy(true);
    try {
      await updateMetadata.mutateAsync({ id: doc.id, data: { title: next } });
      setDialog(null);
      onActionComplete?.();
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (folderId: string) => {
    setBusy(true);
    try {
      await bulkAction.mutateAsync({
        document_ids: [doc.id],
        action: "move",
        folder_id: folderId,
      });
      setMoveOpen(false);
      onActionComplete?.();
    } finally {
      setBusy(false);
    }
  };

  const handleAssignTag = async (tagId: string) => {
    setBusy(true);
    try {
      await bulkAction.mutateAsync({
        document_ids: [doc.id],
        action: "tag",
        tag_ids: [tagId],
      });
      setDialog(null);
      onActionComplete?.();
    } finally {
      setBusy(false);
    }
  };

  const handleTrash = async () => {
    setBusy(true);
    try {
      await trashDocument.mutateAsync(doc.id);
      setDialog(null);
      onActionComplete?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("shrink-0", className)} data-document-actions>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary",
              alwaysVisible
                ? "flex"
                : "hidden group-hover:flex data-[state=open]:flex",
              triggerClassName,
            )}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={`Actions for ${doc.title || doc.original_filename}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem onClick={openRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMoveOpen(true)}>Move…</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("tags")}>
            Assign tags
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-danger"
            onClick={() => setDialog("trash")}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialog === "rename"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !title.trim()}
              onClick={() => void handleRename()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "tags"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Assign tags</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Add a tag to &ldquo;{doc.title || doc.original_filename}&rdquo;.
          </p>
          <div className="max-h-56 overflow-y-auto rounded-md border border-surface-border">
            {tags.length === 0 ? (
              <p className="px-3 py-4 text-xs text-text-muted">No tags yet</p>
            ) : (
              tags.map((t) => {
                const assigned = doc.tags.some((dt) => dt.id === t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy || assigned}
                    className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-surface-hover disabled:opacity-50"
                    onClick={() => void handleAssignTag(t.id)}
                  >
                    {t.name}
                    {assigned ? (
                      <span className="ml-2 text-[11px] text-text-muted">
                        already assigned
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "trash"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Move to Trash</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Move &ldquo;{doc.title || doc.original_filename || "this document"}&rdquo; to Trash?
            You can restore it later from Trash.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void handleTrash()}
            >
              Move to Trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        folders={folders}
        selectedCount={1}
        isPending={busy}
        description={`Choose a folder for “${doc.title || doc.original_filename}”.`}
        onConfirm={(folderId) => handleMove(folderId)}
      />
    </div>
  );
}
