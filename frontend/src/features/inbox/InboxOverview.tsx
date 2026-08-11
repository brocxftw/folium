import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import {
  useInboxOverview,
  useRemoveFromQueue,
  useRetryPreflight,
} from "@/lib/api/hooks";
import type { useDocumentUploader } from "@/lib/api/upload";
import type { InboxActivityItem } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { libraryStateToSearchParams } from "@/features/documents/useDocumentsLibraryState";
import { InboxIngestionHero } from "./InboxIngestionHero";
import { InboxOverviewMetrics } from "./InboxOverviewMetrics";
import { InboxActivityPanel } from "./InboxActivityPanel";
import { InboxPreviewDialog } from "./InboxPreviewDialog";
import type { DateRangeDays, OverviewMetrics } from "./inboxPresentation";

type DocumentUploader = ReturnType<typeof useDocumentUploader>;

interface InboxLocationState {
  justProcessedIds?: string[];
}

interface InboxOverviewProps {
  uploader: DocumentUploader;
}

const HIGHLIGHT_MS = 8000;

export function InboxOverview({ uploader }: InboxOverviewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [rangeDays, setRangeDays] = useState<DateRangeDays>(7);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [removeIds, setRemoveIds] = useState<string[] | null>(null);
  const [justProcessedIds, setJustProcessedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const state = location.state as InboxLocationState | null;
    const ids = state?.justProcessedIds ?? [];
    if (ids.length === 0) return;
    setJustProcessedIds(new Set(ids));
    navigate("/inbox", { replace: true, state: null });
    const timer = window.setTimeout(() => setJustProcessedIds(new Set()), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [location.state, navigate]);

  const {
    data: overview,
    isFetching: overviewFetching,
    refetch: refetchOverview,
  } = useInboxOverview(rangeDays, {
    refetchInterval: (query) => {
      const processing = query.state.data?.processing ?? 0;
      return processing > 0 ? 3000 : false;
    },
  });

  const removeFromQueue = useRemoveFromQueue();
  const retryPreflight = useRetryPreflight();

  const metrics: OverviewMetrics = useMemo(
    () => ({
      processed: overview?.processed ?? 0,
      failed: overview?.failed ?? 0,
      processing: overview?.processing ?? 0,
      totalIngested: overview?.total_ingested ?? 0,
      successRate: overview?.success_rate ?? null,
    }),
    [overview],
  );

  const goWork = (withUpload = false) => {
    navigate(withUpload ? "/inbox?view=work&upload=1" : "/inbox?view=work");
  };

  const openActivityDocument = (doc: InboxActivityItem) => {
    if (doc.activity_status === "processed") {
      const params = libraryStateToSearchParams({
        view: "all",
        folderId: doc.folder_id || undefined,
        q: "",
        searchMode: "hybrid",
        tagIds: [],
        sort: "added_date",
        order: "desc",
        page: 1,
        pageSize: 50,
        docId: doc.id,
      });
      navigate(`/documents?${params.toString()}`);
      return;
    }
    goWork(false);
  };

  const refreshAll = () => {
    void refetchOverview();
    void queryClient.invalidateQueries({ queryKey: ["inbox-activity"] });
  };

  const confirmRemove = async () => {
    if (!removeIds?.length) return;
    await removeFromQueue.mutateAsync(removeIds);
    if (previewId && removeIds.includes(previewId)) setPreviewId(null);
    setRemoveIds(null);
    refreshAll();
  };

  return (
    <div className="h-full overflow-auto bg-[#F8FAFB]">
      <div className="px-5 pb-6 pt-[18px]">
        <div className="flex items-center justify-between gap-3 border-b border-[#E7ECEF] pb-3">
          <div>
            <h1 className="text-lg font-bold leading-tight text-[#14212B]">Inbox</h1>
            <p className="mt-0.5 text-xs text-[#42515D]">
              Ingest documents and track processing
              {overviewFetching ? " · refreshing…" : ""}
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

        <InboxIngestionHero uploader={uploader} onBrowse={() => goWork(true)} />

        <InboxOverviewMetrics
          metrics={metrics}
          rangeDays={rangeDays}
          onRangeDaysChange={setRangeDays}
        />

        <InboxActivityPanel
          rangeDays={rangeDays}
          justProcessedIds={justProcessedIds}
          onPreview={setPreviewId}
          onOpenDocument={openActivityDocument}
          onRetry={(id) =>
            void retryPreflight.mutateAsync(id).then(() => {
              refreshAll();
            })
          }
          onRemove={(id) => setRemoveIds([id])}
          onUpload={() => goWork(true)}
        />
      </div>

      <InboxPreviewDialog
        documentIds={previewId ? [previewId] : []}
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
