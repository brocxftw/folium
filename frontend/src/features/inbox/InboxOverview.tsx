import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import {
  useDocuments,
  useRemoveFromQueue,
  useRetryPreflight,
} from "@/lib/api/hooks";
import type { Document } from "@/lib/api/types";
import type { useDocumentUploader } from "@/lib/api/upload";
import { Button } from "@/components/ui/Button";
import { UploadStatusBar } from "@/components/documents/UploadStatusBar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { InboxIngestionHero } from "./InboxIngestionHero";
import { InboxOverviewMetrics } from "./InboxOverviewMetrics";
import { InboxActivityPanel } from "./InboxActivityPanel";
import { InboxPreviewDialog } from "./InboxPreviewDialog";
import {
  computeOverviewMetrics,
  inDateRange,
  type DateRangeDays,
} from "./inboxPresentation";

type DocumentUploader = ReturnType<typeof useDocumentUploader>;

interface InboxOverviewProps {
  uploader: DocumentUploader;
}

export function InboxOverview({ uploader }: InboxOverviewProps) {
  const navigate = useNavigate();
  const [rangeDays, setRangeDays] = useState<DateRangeDays>(7);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [removeIds, setRemoveIds] = useState<string[] | null>(null);

  const pollWhilePreparing = (query: {
    state: { data?: { items?: Document[] } };
  }) => {
    const items = query.state.data?.items ?? [];
    const busy = items.some(
      (d) =>
        d.inbox_status === "preparing" ||
        d.processing_status === "pending" ||
        d.processing_status === "processing",
    );
    return busy ? 3000 : false;
  };

  const { data: docList, isLoading, refetch, isFetching } = useDocuments(
    {
      inbox: true,
      page_size: 200,
      sort: "added_date",
      order: "desc",
    },
    { refetchInterval: pollWhilePreparing },
  );

  const removeFromQueue = useRemoveFromQueue();
  const retryPreflight = useRetryPreflight();

  const documents = docList?.items ?? [];
  const rangedDocuments = useMemo(
    () => documents.filter((d) => inDateRange(d, rangeDays)),
    [documents, rangeDays],
  );
  const metrics = useMemo(
    () => computeOverviewMetrics(documents, rangeDays),
    [documents, rangeDays],
  );

  const goWork = (withUpload = false) => {
    navigate(withUpload ? "/inbox?view=work&upload=1" : "/inbox?view=work");
  };

  const confirmRemove = async () => {
    if (!removeIds?.length) return;
    await removeFromQueue.mutateAsync(removeIds);
    if (previewId && removeIds.includes(previewId)) setPreviewId(null);
    setRemoveIds(null);
    refetch();
  };

  return (
    <div className="h-full overflow-auto bg-[#F8FAFB]">
      <div className="px-5 pb-6 pt-[18px]">
        <div className="flex items-center justify-between gap-3 border-b border-[#E7ECEF] pb-3">
          <div>
            <h1 className="text-lg font-bold leading-tight text-[#14212B]">Inbox</h1>
            <p className="mt-0.5 text-xs text-[#42515D]">
              Ingest documents and track processing
            </p>
          </div>
          <Button
            className="h-8 rounded-md bg-[#07998E] px-3.5 hover:bg-[#087F78]"
            disabled={uploader.busy}
            onClick={() => goWork(true)}
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
            Upload documents
          </Button>
        </div>

        <UploadStatusBar
          busy={uploader.busy}
          progress={uploader.progress}
          summary={uploader.lastSummary}
          onDismiss={uploader.clearSummary}
        />

        <InboxIngestionHero
          uploader={uploader}
          onBrowse={() => goWork(true)}
        />

        <InboxOverviewMetrics
          metrics={metrics}
          rangeDays={rangeDays}
          onRangeDaysChange={setRangeDays}
        />

        <InboxActivityPanel
          documents={rangedDocuments}
          isLoading={isLoading}
          isFetching={isFetching}
          onRefresh={() => void refetch()}
          onPreview={setPreviewId}
          onOpenWork={() => goWork(false)}
          onRetry={(id) => void retryPreflight.mutateAsync(id).then(() => refetch())}
          onRemove={(id) => setRemoveIds([id])}
          onUpload={() => goWork(true)}
        />
      </div>

      <InboxPreviewDialog
        documentIds={rangedDocuments.map((d) => d.id)}
        activeId={previewId}
        onActiveIdChange={setPreviewId}
      />

      <Dialog open={Boolean(removeIds)} onOpenChange={(o) => !o && setRemoveIds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from queue?</DialogTitle>
            <DialogDescription>
              This removes{" "}
              {removeIds?.length === 1 ? "the document" : `${removeIds?.length} documents`} from
              the Inbox and deletes the uploaded file. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemoveIds(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={removeFromQueue.isPending}
              onClick={() => void confirmRemove()}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
