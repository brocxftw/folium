import { useRef, useState, useCallback, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useDocuments,
  useDocument,
  useFolders,
  useBulkAction,
} from "@/lib/api/hooks";
import type { BulkAction } from "@/lib/api/types";
import type { BulkActionOptions } from "@/components/documents/DocumentToolbar";
import { useDocumentUploader } from "@/lib/api/upload";
import { usePersistedState } from "@/lib/usePersistedState";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/documents/Breadcrumbs";
import { DocumentTable } from "@/components/documents/DocumentTable";
import { DocumentToolbar } from "@/components/documents/DocumentToolbar";
import { UploadDropzone } from "@/components/documents/UploadDropzone";
import { UploadStatusBar } from "@/components/documents/UploadStatusBar";
import { DocumentViewer } from "@/components/viewer/DocumentViewer";
import { DocumentAskInput } from "@/components/viewer/DocumentAskInput";
import { MetadataPanel } from "@/components/inspector/MetadataPanel";
import type { UploadEntry } from "@/lib/uploadTree";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

export function DocumentsPage() {
  const { folderId, documentId } = useParams<{ folderId?: string; documentId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("added_date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [viewerPage, setViewerPage] = useState<number | undefined>();
  const [metaOpen, setMetaOpen] = usePersistedState("folium.metaOpen", true);

  const tagFilter = searchParams.get("tag") ?? undefined;
  const pageParam = searchParams.get("page");

  useEffect(() => {
    if (pageParam) setViewerPage(parseInt(pageParam, 10));
  }, [pageParam]);

  const { data: folders = [] } = useFolders();
  const listParams = {
    folder_id: folderId,
    include_descendants: !!folderId,
    tag_ids: tagFilter ? [tagFilter] : undefined,
    q: searchQuery || undefined,
    sort: sort as "added_date" | "title" | "modified_date" | "created_date",
    order,
    page_size: 100,
  };

  const { data: docList, isLoading, refetch, isFetching } = useDocuments(
    folderId ? { ...listParams, folder_id: folderId } : listParams,
  );

  const activeId = documentId ?? docList?.items[0]?.id;
  const { data: activeDoc } = useDocument(activeId);

  const bulkAction = useBulkAction();
  const uploader = useDocumentUploader();

  const handleActiveChange = (id: string) => {
    if (folderId) {
      navigate(`/documents/folder/${folderId}/${id}`);
    } else {
      navigate(`/documents/${id}`);
    }
  };

  const handleUploadFiles = useCallback(
    async (files: FileList) => {
      await uploader.uploadFileList(files, { folderId });
      refetch();
    },
    [uploader, folderId, refetch],
  );

  const handleEntries = useCallback(
    async (entries: UploadEntry[]) => {
      await uploader.uploadEntries(entries, { folderId });
      refetch();
    },
    [uploader, folderId, refetch],
  );

  const handleBulkAction = async (action: BulkAction, options?: BulkActionOptions) => {
    if (selectedIds.size === 0) return;
    if (action === "move" && !options?.folder_id) return;
    if (action === "tag" && !options?.tag_ids?.length) return;
    await bulkAction.mutateAsync({
      document_ids: Array.from(selectedIds),
      action,
      folder_id: options?.folder_id,
      tag_ids: options?.tag_ids,
    });
    setSelectedIds(new Set());
    refetch();
  };

  const handleCitationClick = (docId: string, page: number | null) => {
    navigate(`/documents/${docId}${page ? `?page=${page}` : ""}`);
  };

  return (
    <UploadDropzone
      onEntries={(entries) => void handleEntries(entries)}
      className="h-full"
      disabled={uploader.busy}
    >      <input
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
      <div className="flex h-full flex-col">
        <div className="border-b border-surface-border bg-surface px-4 py-2">
          <Breadcrumbs folderId={folderId} folders={folders} />
        </div>

        <UploadStatusBar
          busy={uploader.busy}
          progress={uploader.progress}
          summary={uploader.lastSummary}
          onDismiss={uploader.clearSummary}
        />

        <div className="flex flex-1 min-h-0">
          <div className="flex w-[340px] shrink-0 flex-col border-r border-surface-border bg-surface">
            <DocumentToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCount={selectedIds.size}
              sort={sort}
              order={order}
              onSortChange={(s, o) => {
                setSort(s);
                setOrder(o);
              }}
              onRefresh={() => refetch()}
              onUploadFiles={() => fileInputRef.current?.click()}
              onUploadFolder={() => folderInputRef.current?.click()}
              onBulkAction={handleBulkAction}
              isRefreshing={isFetching}
              isBulkPending={bulkAction.isPending}
              uploadBusy={uploader.busy}
            />
            <DocumentTable
              documents={docList?.items ?? []}
              selectedIds={selectedIds}
              activeId={activeId}
              onSelect={setSelectedIds}
              onActiveChange={handleActiveChange}
              isLoading={isLoading}
            />
          </div>

          <div className="flex flex-1 flex-col min-w-0">
            <DocumentViewer
              document={activeDoc}
              page={viewerPage}
              onPageChange={setViewerPage}
              className="flex-1 min-h-0"
            />
            <DocumentAskInput
              documentId={activeId}
              onCitationClick={handleCitationClick}
            />
          </div>

          <div
            className={cn(
              "shrink-0 border-l border-surface-border bg-surface flex flex-col transition-[width] duration-200",
              metaOpen ? "w-[280px]" : "w-9",
            )}
          >
            <div className="flex items-center border-b border-surface-border px-1 py-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setMetaOpen((v) => !v)}
                    className="rounded p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-primary"
                    aria-label={metaOpen ? "Collapse details" : "Expand details"}
                  >
                    {metaOpen ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {metaOpen ? "Collapse details" : "Expand details"}
                </TooltipContent>
              </Tooltip>
              {metaOpen && (
                <span className="text-xs font-medium text-text-secondary">Details</span>
              )}
            </div>
            {metaOpen && (
              <div className="min-h-0 flex-1 overflow-hidden">
                <MetadataPanel document={activeDoc} />
              </div>
            )}
          </div>
        </div>
      </div>
    </UploadDropzone>
  );
}
