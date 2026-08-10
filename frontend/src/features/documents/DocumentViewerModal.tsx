import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Trash2 } from "lucide-react";
import { useDocument, useTrashDocument } from "@/lib/api/hooks";
import type { Document, Folder } from "@/lib/api/types";
import { DocumentViewer } from "@/components/viewer/DocumentViewer";
import { DocumentInspector } from "@/components/inspector/DocumentInspector";
import { Breadcrumbs } from "@/components/documents/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { RetrievalReadinessBadge } from "./RetrievalReadinessBadge";
import { canAskDocument } from "./retrievalReadiness";

interface DocumentViewerModalProps {
  documentIds: string[];
  activeId: string | null;
  page?: number;
  folders: Folder[];
  onActiveIdChange: (id: string | null) => void;
  onPageChange?: (page: number) => void;
  onAsk?: (document: Document) => void;
  onNavigateToFolder?: (folderId: string | undefined) => void;
  onTrashed?: (documentId: string) => void;
}

export function DocumentViewerModal({
  documentIds,
  activeId,
  page,
  folders,
  onActiveIdChange,
  onPageChange,
  onAsk,
  onNavigateToFolder,
  onTrashed,
}: DocumentViewerModalProps) {
  const open = Boolean(activeId);
  const index = activeId ? documentIds.indexOf(activeId) : -1;
  const { data: doc } = useDocument(activeId ?? undefined);
  const trashDocument = useTrashDocument();
  const [confirmTrash, setConfirmTrash] = useState(false);

  const go = (delta: number) => {
    if (index < 0) return;
    const next = documentIds[index + delta];
    if (next) onActiveIdChange(next);
  };

  const handleTrash = async () => {
    if (!doc) return;
    await trashDocument.mutateAsync(doc.id);
    setConfirmTrash(false);
    onTrashed?.(doc.id);
    onActiveIdChange(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onActiveIdChange(null);
        }}
      >
        <DialogContent className="flex h-[95vh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="flex flex-row items-start justify-between gap-3 border-b border-surface-border px-4 py-3 pr-12 space-y-0">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">
                {doc?.title || doc?.original_filename || "Document"}
              </DialogTitle>
              {doc && (
                <Breadcrumbs
                  className="mt-1"
                  folderId={doc.folder_id ?? undefined}
                  folders={folders}
                  onNavigate={
                    onNavigateToFolder
                      ? (folderId) => onNavigateToFolder(folderId)
                      : undefined
                  }
                />
              )}
              {doc && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <RetrievalReadinessBadge document={doc} />
                  {!canAskDocument(doc) && (
                    <span className="text-[11px] text-text-muted">
                      Not ready for Ask yet — indexing still needed
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {doc && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mr-1 text-danger hover:text-danger"
                  disabled={trashDocument.isPending}
                  onClick={() => setConfirmTrash(true)}
                  aria-label="Move to trash"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Trash
                </Button>
              )}
              {doc && onAsk && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mr-1"
                  disabled={!canAskDocument(doc)}
                  onClick={() => onAsk(doc)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Ask
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={index <= 0}
                onClick={() => go(-1)}
                aria-label="Previous document"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[3rem] text-center text-xs text-text-muted">
                {index >= 0 ? `${index + 1} / ${documentIds.length}` : "—"}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={index < 0 || index >= documentIds.length - 1}
                onClick={() => go(1)}
                aria-label="Next document"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 bg-surface-muted">
              <DocumentViewer
                document={doc}
                page={page}
                onPageChange={onPageChange}
                className="h-full"
              />
            </div>
            <aside className="hidden w-[320px] shrink-0 flex-col overflow-hidden border-l border-surface-border bg-surface md:flex">
              <DocumentInspector document={doc} />
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmTrash} onOpenChange={setConfirmTrash}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Trash</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Move &ldquo;{doc?.title || doc?.original_filename || "this document"}&rdquo; to Trash?
            You can restore it later from Trash.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmTrash(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={trashDocument.isPending}
              onClick={() => void handleTrash()}
            >
              Move to Trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
