import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDocument } from "@/lib/api/hooks";
import { DocumentViewer } from "@/components/viewer/DocumentViewer";
import { MetadataPanel } from "@/components/inspector/MetadataPanel";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { RetrievalReadinessBadge } from "./RetrievalReadinessBadge";
import { canAskDocument } from "./retrievalReadiness";

interface DocumentViewerModalProps {
  documentIds: string[];
  activeId: string | null;
  page?: number;
  onActiveIdChange: (id: string | null) => void;
  onPageChange?: (page: number) => void;
}

export function DocumentViewerModal({
  documentIds,
  activeId,
  page,
  onActiveIdChange,
  onPageChange,
}: DocumentViewerModalProps) {
  const open = Boolean(activeId);
  const index = activeId ? documentIds.indexOf(activeId) : -1;
  const { data: doc } = useDocument(activeId ?? undefined);

  const go = (delta: number) => {
    if (index < 0) return;
    const next = documentIds[index + delta];
    if (next) onActiveIdChange(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onActiveIdChange(null);
      }}
    >
      <DialogContent className="flex h-[min(92vh,900px)] w-[min(96vw,1200px)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-start justify-between gap-3 border-b border-surface-border px-4 py-3 pr-12 space-y-0">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base">
              {doc?.title || doc?.original_filename || "Document"}
            </DialogTitle>
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
          <aside className="hidden w-[280px] shrink-0 flex-col overflow-y-auto border-l border-surface-border bg-surface md:flex">
            <MetadataPanel document={doc} />
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
