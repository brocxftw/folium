import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useDocument,
  useDocumentContent,
  useDocumentSuggestions,
  useJobs,
} from "@/lib/api/hooks";
import { DocumentViewer } from "@/components/viewer/DocumentViewer";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { InboxFolderControl } from "./InboxFolderControl";
import { InboxTagsControl } from "./InboxTagsControl";
import { InboxStatusBadge } from "./InboxStatusBadge";
import { SuggestionChip, TagSuggestionTiles } from "./InboxSuggestions";
import { documentSecondaryMeta } from "./formatMeta";

interface InboxPreviewDialogProps {
  documentIds: string[];
  activeId: string | null;
  onActiveIdChange: (id: string | null) => void;
}

export function InboxPreviewDialog({
  documentIds,
  activeId,
  onActiveIdChange,
}: InboxPreviewDialogProps) {
  const open = Boolean(activeId);
  const index = activeId ? documentIds.indexOf(activeId) : -1;
  const { data: doc } = useDocument(activeId ?? undefined);
  const { data: docJobs = [] } = useJobs(undefined, activeId ?? undefined);
  const { data: suggestions = [] } = useDocumentSuggestions(doc?.id);
  const { data: content, isLoading: contentLoading } = useDocumentContent(doc?.id);

  const titleSuggestion = suggestions.find((s) => s.field === "title");
  const folderSuggestion = suggestions.find((s) => s.field === "folder");
  const tagSuggestions = suggestions.filter((s) => s.field === "tags");

  const ocrText =
    content?.pages
      ?.map((p) => p.text.trim())
      .filter(Boolean)
      .join("\n\n") ?? "";

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
      <DialogContent className="flex h-[min(90vh,840px)] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-start justify-between gap-3 border-b border-surface-border px-4 py-3 pr-12 space-y-0">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base">
              {doc?.original_filename || doc?.title || "Document"}
            </DialogTitle>
            {doc && (
              <p className="mt-0.5 text-xs text-text-muted">{documentSecondaryMeta(doc)}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={index <= 0}
              onClick={() => go(-1)}
              aria-label="Previous"
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
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 bg-surface-muted">
            <DocumentViewer document={doc} className="h-full" />
          </div>
          <aside className="flex w-[280px] shrink-0 flex-col gap-4 border-l border-surface-border bg-surface p-4 overflow-y-auto">
            {doc ? (
              <>
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    Status
                  </p>
                  <InboxStatusBadge
                    status={doc.inbox_status}
                    error={doc.processing_error}
                    document={doc}
                    jobs={docJobs}
                  />
                  {doc.processing_error && (
                    <p className="mt-2 text-xs text-danger">{doc.processing_error}</p>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    Filename
                  </p>
                  <p className="text-sm text-text-primary break-words">
                    {doc.title || doc.original_filename || "—"}
                  </p>
                  {titleSuggestion && (
                    <div className="mt-2">
                      <SuggestionChip suggestion={titleSuggestion} />
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    Folder
                  </p>
                  <InboxFolderControl document={doc} />
                  {folderSuggestion && (
                    <div className="mt-2">
                      <SuggestionChip suggestion={folderSuggestion} />
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    Tags
                  </p>
                  <InboxTagsControl document={doc} />
                  {tagSuggestions.length > 0 && (
                    <div className="mt-2">
                      <TagSuggestionTiles suggestions={tagSuggestions} />
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    OCR output
                  </p>
                  {contentLoading ? (
                    <p className="text-xs text-text-muted">Loading…</p>
                  ) : ocrText ? (
                    <div className="max-h-48 overflow-y-auto rounded-md border border-surface-border bg-surface-muted px-2.5 py-2 text-xs leading-relaxed text-text-muted whitespace-pre-wrap">
                      {ocrText}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">No OCR text yet</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-text-muted">Loading…</p>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
