import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useBulkAction,
  useDocuments,
  useFolders,
  useTags,
} from "@/lib/api/hooks";
import type { BulkAction } from "@/lib/api/types";
import { useDocumentUploader } from "@/lib/api/upload";
import type { UploadEntry } from "@/lib/uploadTree";
import { UploadDropzone } from "@/components/documents/UploadDropzone";
import { UploadStatusBar } from "@/components/documents/UploadStatusBar";
import { DocumentTable } from "@/components/documents/DocumentTable";
import { Breadcrumbs } from "@/components/documents/Breadcrumbs";
import { DocumentExplorerSidebar } from "./DocumentExplorerSidebar";
import { DocumentsHeader } from "./DocumentsHeader";
import { DocumentViewTabs } from "./DocumentViewTabs";
import { RecentDocuments } from "./RecentDocuments";
import {
  DocumentBulkToolbar,
  DocumentResultsToolbar,
  type BulkActionOptions,
} from "./DocumentBulkToolbar";
import { DocumentViewerModal } from "./DocumentViewerModal";
import { useDocumentsLibraryState } from "./useDocumentsLibraryState";

function emptyMessageForView(
  view: string,
  hasFolder: boolean,
  hasQuery: boolean,
): string {
  if (hasQuery) return "No documents match this filter";
  if (view === "unprocessed") return "No unprocessed documents";
  if (view === "recent") return "No recently added documents";
  if (hasFolder) return "No documents in this folder";
  return "No documents yet";
}

export function DocumentsPage() {
  const {
    state,
    patch,
    openDocument,
    closeDocument,
    setViewerPage,
    listParams,
  } = useDocumentsLibraryState();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: folders = [] } = useFolders();
  const { data: tags = [] } = useTags();

  const { data: docList, isLoading, refetch, isFetching } = useDocuments(listParams);

  // Bounded recent cards — always newest library docs (not unprocessed-only)
  const { data: recentList } = useDocuments(
    {
      inbox: false,
      sort: "added_date",
      order: "desc",
      page: 1,
      page_size: 5,
      folder_id: state.folderId,
      include_descendants: !!state.folderId,
    },
    { enabled: state.view !== "unprocessed" },
  );

  const bulkAction = useBulkAction();
  const uploader = useDocumentUploader();

  const documents = docList?.items ?? [];
  const documentIds = useMemo(() => documents.map((d) => d.id), [documents]);

  const folderName = useMemo(() => {
    if (!state.folderId) return undefined;
    return folders.find((f) => f.id === state.folderId)?.name;
  }, [folders, state.folderId]);

  const title = folderName ?? "Documents";
  const subtitle =
    state.view === "unprocessed"
      ? "Documents still preparing, awaiting review, or indexing for retrieval"
      : state.view === "recent"
        ? "Recently added to your library"
        : "Find and organise your library";

  const filterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onClear: () => void }> = [];
    if (state.q.trim()) {
      chips.push({
        id: "q",
        label: `Filter: ${state.q.trim()}`,
        onClear: () => patch({ q: "" }),
      });
    }
    for (const tagId of state.tagIds) {
      const tag = tags.find((t) => t.id === tagId);
      chips.push({
        id: `tag-${tagId}`,
        label: tag ? `Tag: ${tag.name}` : "Tag",
        onClear: () =>
          patch({ tagIds: state.tagIds.filter((id) => id !== tagId) }),
      });
    }
    if (state.folderId) {
      chips.push({
        id: "folder",
        label: folderName ? `Folder: ${folderName}` : "Folder",
        onClear: () => patch({ folderId: undefined }),
      });
    }
    return chips;
  }, [state.q, state.tagIds, state.folderId, tags, folderName, patch]);

  const handleUploadFiles = useCallback(
    async (files: FileList) => {
      await uploader.uploadFileList(files, { folderId: state.folderId });
      void refetch();
    },
    [uploader, state.folderId, refetch],
  );

  const handleEntries = useCallback(
    async (entries: UploadEntry[]) => {
      await uploader.uploadEntries(entries, { folderId: state.folderId });
      void refetch();
    },
    [uploader, state.folderId, refetch],
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
    void refetch();
  };

  const handleTagToggle = (tagId: string) => {
    const next = state.tagIds.includes(tagId)
      ? state.tagIds.filter((id) => id !== tagId)
      : [...state.tagIds, tagId];
    patch({ tagIds: next });
  };

  // Clear selection when the result set identity changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [state.view, state.folderId, state.q, state.tagIds.join(","), state.page]);

  const showRecentCards =
    state.view !== "unprocessed" &&
    !state.q.trim() &&
    state.tagIds.length === 0 &&
    state.page === 1;

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

      <div className="flex h-full min-h-0">
        <DocumentExplorerSidebar
          folders={folders}
          tags={tags}
          view={state.view}
          folderId={state.folderId}
          tagIds={state.tagIds}
          onViewChange={(view) => patch({ view, folderId: undefined })}
          onFolderSelect={(folderId) =>
            patch({ folderId, view: folderId ? "all" : state.view })
          }
          onTagToggle={handleTagToggle}
          className="hidden md:flex"
        />

        <div className="flex min-w-0 flex-1 flex-col bg-surface">
          <DocumentsHeader
            title={title}
            subtitle={subtitle}
            searchQuery={state.q}
            onSearchCommit={(q) => patch({ q })}
            onUploadFiles={() => fileInputRef.current?.click()}
            onUploadFolder={() => folderInputRef.current?.click()}
            uploadBusy={uploader.busy}
          />

          <UploadStatusBar
            busy={uploader.busy}
            progress={uploader.progress}
            summary={uploader.lastSummary}
            onDismiss={uploader.clearSummary}
          />

          {state.folderId && (
            <div className="border-b border-surface-border px-4 py-2">
              <Breadcrumbs folderId={state.folderId} folders={folders} />
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DocumentViewTabs
                view={state.view}
                onChange={(view) => patch({ view })}
              />
              {isFetching && !isLoading && (
                <span className="text-[11px] text-text-muted">Updating…</span>
              )}
            </div>

            {showRecentCards && (
              <RecentDocuments
                documents={recentList?.items ?? []}
                onOpen={(id) => openDocument(id)}
              />
            )}

            <DocumentBulkToolbar
              selectedCount={selectedIds.size}
              onClear={() => setSelectedIds(new Set())}
              onBulkAction={handleBulkAction}
              isPending={bulkAction.isPending}
              folders={folders}
              tags={tags}
            />

            <DocumentResultsToolbar
              total={docList?.total ?? 0}
              page={state.page}
              pageSize={state.pageSize}
              sort={state.sort}
              order={state.order}
              onSortChange={(sort, order) => patch({ sort, order })}
              filterChips={filterChips}
            />

            <div className="flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-md border border-surface-border">
              <DocumentTable
                documents={documents}
                selectedIds={selectedIds}
                activeId={state.docId}
                onSelect={setSelectedIds}
                onActiveChange={(id) => openDocument(id)}
                isLoading={isLoading}
                emptyMessage={emptyMessageForView(
                  state.view,
                  !!state.folderId,
                  !!state.q.trim(),
                )}
                page={state.page}
                pageSize={state.pageSize}
                total={docList?.total}
                onPageChange={(page) => patch({ page })}
              />
            </div>
          </div>
        </div>
      </div>

      <DocumentViewerModal
        documentIds={documentIds}
        activeId={state.docId ?? null}
        page={state.viewerPage}
        onActiveIdChange={(id) => {
          if (id) openDocument(id);
          else closeDocument();
        }}
        onPageChange={setViewerPage}
      />
    </UploadDropzone>
  );
}
