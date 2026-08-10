import { useState } from "react";
import { Folder } from "lucide-react";
import type { Document } from "@/lib/api/types";
import { useFolders, useUpdateDocumentMetadata } from "@/lib/api/hooks";
import { Button } from "@/components/ui/Button";
import { MoveToFolderDialog } from "@/components/documents/MoveToFolderDialog";

interface DocumentFolderControlProps {
  document: Document;
}

export function DocumentFolderControl({ document: doc }: DocumentFolderControlProps) {
  const { data: folders = [] } = useFolders();
  const update = useUpdateDocumentMetadata();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1 flex items-center gap-2">
      <Folder className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      <span className="min-w-0 truncate text-[13px] text-text-primary">
        {doc.folder_path ?? "—"}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        Change
      </Button>
      <MoveToFolderDialog
        open={open}
        onOpenChange={setOpen}
        folders={folders}
        selectedCount={1}
        title="Change folder"
        description="Move this document to another folder."
        isPending={update.isPending}
        onConfirm={async (folderId) => {
          await update.mutateAsync({ id: doc.id, data: { folder_id: folderId } });
        }}
      />
    </div>
  );
}
