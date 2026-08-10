import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpDown,
  FolderInput,
  Search,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useAICapabilities,
  useBulkAction,
  useDocuments,
  useFolders,
  usePendingSuggestions,
  useProcessInboxDocuments,
  useRemoveFromQueue,
  useRetryPreflight,
  useTags,
} from "@/lib/api/hooks";
import type { Document, InboxStatus, Suggestion } from "@/lib/api/types";
import type { useDocumentUploader } from "@/lib/api/upload";
import type { UploadEntry } from "@/lib/uploadTree";
import { cn } from "@/lib/utils";
import { UploadDropzone } from "@/components/documents/UploadDropzone";
import { UploadStatusBar } from "@/components/documents/UploadStatusBar";
import { MoveToFolderDialog } from "@/components/documents/MoveToFolderDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { InboxTable } from "./InboxTable";
import { InboxPreviewDialog } from "./InboxPreviewDialog";

type StatusTab = "all" | InboxStatus;
type DocumentUploader = ReturnType<typeof useDocumentUploader>;

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "needs_review", label: "Needs review" },
  { id: "failed", label: "Failed" },
  { id: "preparing", label: "Preparing" },
];

const SORT_OPTIONS = [
  { value: "added_date", label: "Date added" },
  { value: "modified_date", label: "Modified" },
  { value: "title", label: "Title" },
];

function isProcessable(doc: Document): boolean {
  if (doc.inbox_status === "preparing" || doc.inbox_status === "failed") return false;
  if (doc.pending_folder_path) return true;
  if (
    doc.folder_path &&
    !/\/inbox$/i.test(doc.folder_path) &&
    doc.folder_path.toLowerCase() !== "inbox"
  ) {
    return true;
  }
  return false;
}

interface InboxWorkViewProps {
  uploader: DocumentUploader;
}

export function InboxWorkView({ uploader }: InboxWorkViewProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [sort, setSort] = useState("added_date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [removeIds, setRemoveIds] = useState<string[] | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const listParams = {
    inbox: true as const,
    q: searchQuery || undefined,
    inbox_status: statusTab === "all" ? undefined : statusTab,
    sort: sort as "added_date" | "title" | "modified_date" | "created_date",
    order,
    page_size: 100,
  };

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
    listParams,
    { refetchInterval: pollWhilePreparing },
  );
  const { data: allInbox } = useDocuments(
    { inbox: true, page_size: 100 },
    { refetchInterval: pollWhilePreparing },
  );
  const { data: folders = [] } = useFolders();
  const { data: tags = [] } = useTags();
  const { data: aiPolicy } = useAICapabilities();
  const aiSuggestionsAvailable = Boolean(
    aiPolicy?.auto_tagging && aiPolicy.chat_available,
  );
  const { data: pendingSuggestions = [] } = usePendingSuggestions(aiSuggestionsAvailable);

  const bulkAction = useBulkAction();
  const processDocs = useProcessInboxDocuments();
  const removeFromQueue = useRemoveFromQueue();
  const retryPreflight = useRetryPreflight();

  const documents = docList?.items ?? [];
  const documentIds = documents.map((d) => d.id);

  const suggestionsByDoc = useMemo(() => {
    const map: Record<string, Suggestion[]> = {};
    for (const s of pendingSuggestions) {
      (map[s.document_id] ??= []).push(s);
    }
    return map;
  }, [pendingSuggestions]);

  const counts = useMemo(() => {
    const items = allInbox?.items ?? [];
    const c: Record<StatusTab, number> = {
      all: items.length,
      ready: 0,
      needs_review: 0,
      failed: 0,
      preparing: 0,
    };
    for (const d of items) {
      const s = d.inbox_status;
      if (s) c[s] += 1;
    }
    return c;
  }, [allInbox?.items]);

  const selectedDocs = documents.filter((d) => selectedIds.has(d.id));
  const processTargets =
    selectedIds.size > 0 ? selectedDocs.filter(isProcessable) : documents.filter(isProcessable);
  const processCount = processTargets.length;

  useEffect(() => {
    if (searchParams.get("upload") !== "1") return;
    const timer = window.setTimeout(() => {
      fileInputRef.current?.click();
      const next = new URLSearchParams(searchParams);
      next.delete("upload");
      setSearchParams(next, { replace: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams]);

  const handleUploadFiles = async (files: FileList) => {
    await uploader.uploadFileList(files);
    refetch();
  };

  const handleEntries = async (entries: UploadEntry[]) => {
    await uploader.uploadEntries(entries);
    refetch();
  };

  const confirmRemove = async () => {
    if (!removeIds?.length) return;
    await removeFromQueue.mutateAsync(removeIds);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of removeIds) next.delete(id);
      return next;
    });
    if (previewId && removeIds.includes(previewId)) setPreviewId(null);
    setRemoveIds(null);
    setResultMsg(
      removeIds.length === 1
        ? "Removed 1 document from the queue."
        : `Removed ${removeIds.length} documents from the queue.`,
    );
    refetch();
  };

  const handleProcess = async () => {
    if (processCount === 0) return;
    const result = await processDocs.mutateAsync(processTargets.map((d) => d.id));
    setSelectedIds(new Set());
    const processedIds = result.processed.map((p) => p.id);
    if (processedIds.length > 0) {
      navigate("/inbox", { state: { justProcessedIds: processedIds } });
      return;
    }
    const parts = [
      result.skipped.length ? `${result.skipped.length} skipped` : null,
      result.failed.length ? `${result.failed.length} failed` : null,
    ].filter(Boolean);
    setResultMsg(parts.join(" · ") || "Nothing processed");
    refetch();
  };

  const handleBulkFolder = async (folderId: string) => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await bulkAction.mutateAsync({
        document_ids: [id],
        action: "move",
        folder_id: folderId,
      });
    }
    setSelectedIds(new Set());
    refetch();
  };

  const handleBulkTag = async (tagId: string) => {
    await bulkAction.mutateAsync({
      document_ids: Array.from(selectedIds),
      action: "tag",
      tag_ids: [tagId],
    });
    setTagOpen(false);
    refetch();
  };

  return (
    <UploadDropzone
      onEntries={(entries) => void handleEntries(entries)}
      className="h-full"
      disabled={uploader.busy}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && void handleUploadFiles(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        // @ts-expect-error webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => e.target.files && void handleUploadFiles(e.target.files)}
      />

      <div className="flex h-full flex-col bg-surface">
        <div className="flex items-start justify-between gap-3 border-b border-surface-border px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="-ml-1 h-7 px-1.5"
                onClick={() => navigate("/inbox")}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Inbox
              </Button>
            </div>
            <h1 className="mt-1 text-base font-semibold text-text-primary">Review & file</h1>
            <p className="mt-0.5 text-xs text-text-secondary">
              Documents awaiting review and filing
            </p>
            {!aiSuggestionsAvailable && (
              <p className="mt-1 text-[11px] text-text-muted">
                AI filing suggestions unavailable — documents can still be filed manually.
              </p>
            )}
            {aiSuggestionsAvailable && (
              <p className="mt-1 text-[11px] text-emerald-800">
                AI suggestions available
                {pendingSuggestions.length > 0
                  ? ` · ${pendingSuggestions.length} pending`
                  : ""}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={uploader.busy}>
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                Upload files…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => folderInputRef.current?.click()}>
                Upload folder…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <UploadStatusBar
          busy={uploader.busy}
          progress={uploader.progress}
          summary={uploader.lastSummary}
          onDismiss={uploader.clearSummary}
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-surface-border px-3 py-2">
          {selectedIds.size > 0 ? (
            <>
              <span className="text-xs font-medium text-text-primary">
                {selectedIds.size} selected
              </span>
              <Button size="sm" variant="secondary" onClick={() => setMoveOpen(true)}>
                <FolderInput className="h-3.5 w-3.5" />
                Assign folder
              </Button>
              <Popover open={tagOpen} onOpenChange={setTagOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Tag className="h-3.5 w-3.5" />
                    Add tags
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-2">
                  <div className="max-h-48 overflow-y-auto">
                    {tags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="block w-full truncate rounded px-2 py-1.5 text-left text-xs hover:bg-surface-hover"
                        onClick={() => void handleBulkTag(t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                    {tags.length === 0 && (
                      <p className="px-2 py-2 text-xs text-text-muted">No tags yet</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setRemoveIds(Array.from(selectedIds))}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                disabled={processCount === 0 || processDocs.isPending}
                onClick={() => void handleProcess()}
              >
                Process {processCount} selected
              </Button>
            </>
          ) : (
            <>
              <div className="relative min-w-[180px] max-w-xs flex-1">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inbox…"
                  className="h-7 pl-8"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusTab(tab.id)}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs",
                      statusTab === tab.id
                        ? "bg-surface-muted font-medium text-text-primary"
                        : "text-text-secondary hover:bg-surface-hover",
                    )}
                  >
                    {tab.label}
                    <span className="ml-1 text-text-muted">{counts[tab.id]}</span>
                  </button>
                ))}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {SORT_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => {
                        if (sort === opt.value) {
                          setOrder((o) => (o === "asc" ? "desc" : "asc"));
                        } else {
                          setSort(opt.value);
                          setOrder("desc");
                        }
                      }}
                    >
                      {opt.label}
                      {sort === opt.value ? (order === "asc" ? " ↑" : " ↓") : ""}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex-1" />
              <Button
                size="sm"
                disabled={processCount === 0 || processDocs.isPending}
                onClick={() => void handleProcess()}
              >
                Process {processCount} document{processCount === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </div>

        <InboxTable
          documents={documents}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onPreview={setPreviewId}
          onRemove={(id) => setRemoveIds([id])}
          onRetry={(id) => void retryPreflight.mutateAsync(id).then(() => refetch())}
          suggestionsByDoc={suggestionsByDoc}
          isLoading={isLoading}
          empty={
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium text-text-primary">Inbox is clear</p>
              <p className="mt-1 text-xs text-text-secondary">
                Documents awaiting review and filing will appear here.
              </p>
              <Button
                size="sm"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploader.busy}
              >
                Upload documents
              </Button>
            </div>
          }
        />

        <div className="flex items-center justify-between border-t border-surface-border px-4 py-2 text-xs text-text-muted">
          <span>
            {docList?.total ?? 0} document{(docList?.total ?? 0) === 1 ? "" : "s"}
            {isFetching ? " · refreshing…" : ""}
          </span>
        </div>
      </div>

      <InboxPreviewDialog
        documentIds={documentIds}
        activeId={previewId}
        onActiveIdChange={setPreviewId}
      />

      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        folders={folders}
        selectedCount={selectedIds.size}
        onConfirm={handleBulkFolder}
        isPending={bulkAction.isPending}
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

      {resultMsg && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-surface-border bg-surface px-4 py-2 text-sm shadow-lg">
          <div className="flex items-center gap-3">
            <span>{resultMsg}</span>
            <button
              type="button"
              className="text-xs text-text-muted hover:text-text-primary"
              onClick={() => setResultMsg(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </UploadDropzone>
  );
}
