import { useMemo, useState } from "react";
import { Folder as FolderIcon, RotateCcw, Trash2 } from "lucide-react";
import {
  useBulkAction,
  useDeleteDocument,
  useDocuments,
  useDocument,
  useEmptyTrash,
  useFolders,
  usePurgeFolder,
  useRestoreDocument,
  useRestoreFolder,
  useTrashCount,
} from "@/lib/api/hooks";
import { formatDate } from "@/lib/utils";
import type { Document, Folder } from "@/lib/api/types";
import { DocumentViewer } from "@/components/viewer/DocumentViewer";
import { MetadataPanel } from "@/components/inspector/MetadataPanel";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";

function daysLeft(purgeAfter: string | null | undefined): string {
  if (!purgeAfter) return "—";
  const ms = new Date(purgeAfter).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  if (days <= 0) return "Soon";
  return `${days}d`;
}

export function TrashPage() {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | undefined>();

  const { data: count } = useTrashCount();
  const { data: docList, isLoading, refetch } = useDocuments({
    trashed: true,
    sort: "modified_date",
    order: "desc",
    page_size: 200,
  });
  const { data: trashedFolders = [] } = useFolders(true);
  const restoreDoc = useRestoreDocument();
  const deleteDoc = useDeleteDocument();
  const restoreFolder = useRestoreFolder();
  const purgeFolder = usePurgeFolder();
  const emptyTrash = useEmptyTrash();
  const bulk = useBulkAction();

  const retention = count?.retention_days ?? 30;
  const documents = docList?.items ?? [];

  // Prefer top-level trashed folders (parent not also trashed) for the folder list.
  const rootTrashedFolders = useMemo(() => {
    const trashedIds = new Set(trashedFolders.map((f) => f.id));
    return trashedFolders.filter(
      (f) => !f.parent_id || !trashedIds.has(f.parent_id),
    );
  }, [trashedFolders]);

  // Docs still sitting inside trashed folders are restored with the folder.
  const looseDocuments = useMemo(() => {
    const trashedFolderIds = new Set(trashedFolders.map((f) => f.id));
    return documents.filter((d) => !trashedFolderIds.has(d.folder_id));
  }, [documents, trashedFolders]);

  const resolvedActiveId =
    activeId && looseDocuments.some((d) => d.id === activeId)
      ? activeId
      : looseDocuments[0]?.id;
  const { data: activeDoc } = useDocument(resolvedActiveId);

  const toggleDoc = (id: string, checked: boolean) => {
    const next = new Set(selectedDocIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedDocIds(next);
  };

  const toggleFolder = (id: string, checked: boolean) => {
    const next = new Set(selectedFolderIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedFolderIds(next);
  };

  const handleRestoreSelected = async () => {
    for (const id of selectedFolderIds) {
      await restoreFolder.mutateAsync(id);
    }
    if (selectedDocIds.size) {
      await bulk.mutateAsync({
        document_ids: Array.from(selectedDocIds),
        action: "restore",
      });
    }
    setSelectedDocIds(new Set());
    setSelectedFolderIds(new Set());
    refetch();
  };

  const handleDeleteSelectedForever = async () => {
    if (!confirm("Permanently delete selected items? This cannot be undone.")) return;
    for (const id of selectedFolderIds) {
      await purgeFolder.mutateAsync(id);
    }
    for (const id of selectedDocIds) {
      await deleteDoc.mutateAsync(id);
    }
    setSelectedDocIds(new Set());
    setSelectedFolderIds(new Set());
    setActiveId(undefined);
    refetch();
  };

  const handleEmptyTrash = async () => {
    if (
      !confirm(
        `Permanently delete everything in Trash now? Items are otherwise removed after ${retention} days.`,
      )
    ) {
      return;
    }
    await emptyTrash.mutateAsync();
    setSelectedDocIds(new Set());
    setSelectedFolderIds(new Set());
    setActiveId(undefined);
    refetch();
  };

  const selectedCount = selectedDocIds.size + selectedFolderIds.size;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-surface-border bg-surface px-4 py-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Trash</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Items are kept for {retention} days, then permanently deleted automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={selectedCount === 0}
            onClick={() => void handleRestoreSelected()}
            className="gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={selectedCount === 0}
            onClick={() => void handleDeleteSelectedForever()}
            className="gap-1 text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete forever
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!count?.total}
            onClick={() => void handleEmptyTrash()}
            className="gap-1"
          >
            Empty trash
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex w-[380px] shrink-0 flex-col border-r border-surface-border bg-surface">
          <div className="flex-1 overflow-auto scrollbar-thin">
            {isLoading ? (
              <p className="p-4 text-sm text-text-muted">Loading trash…</p>
            ) : rootTrashedFolders.length === 0 && looseDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                <Trash2 className="h-10 w-10 text-text-muted/40" />
                <p className="text-sm text-text-secondary">Trash is empty</p>
              </div>
            ) : (
              <div className="py-2">
                {rootTrashedFolders.length > 0 && (
                  <section className="mb-3">
                    <h2 className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                      Folders
                    </h2>
                    <ul>
                      {rootTrashedFolders.map((folder) => (
                        <TrashFolderRow
                          key={folder.id}
                          folder={folder}
                          selected={selectedFolderIds.has(folder.id)}
                          onSelect={toggleFolder}
                          onRestore={() => void restoreFolder.mutateAsync(folder.id)}
                        />
                      ))}
                    </ul>
                  </section>
                )}
                {looseDocuments.length > 0 && (
                  <section>
                    <h2 className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                      Documents
                    </h2>
                    <ul>
                      {looseDocuments.map((doc) => (
                        <TrashDocRow
                          key={doc.id}
                          document={doc}
                          selected={selectedDocIds.has(doc.id)}
                          active={resolvedActiveId === doc.id}
                          onSelect={toggleDoc}
                          onClick={setActiveId}
                          onRestore={() => void restoreDoc.mutateAsync(doc.id)}
                        />
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col min-w-0">
          <DocumentViewer document={activeDoc} className="flex-1 min-h-0" />
        </div>

        <div className="w-[280px] shrink-0 border-l border-surface-border bg-surface overflow-hidden">
          <MetadataPanel document={activeDoc} />
        </div>
      </div>
    </div>
  );
}

function TrashFolderRow({
  folder,
  selected,
  onSelect,
  onRestore,
}: {
  folder: Folder;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onRestore: () => void;
}) {
  return (
    <li className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover">
      <Checkbox checked={selected} onCheckedChange={(c) => onSelect(folder.id, !!c)} />
      <FolderIcon className="h-4 w-4 text-text-muted shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-text-primary">{folder.name}</p>
        <p className="truncate text-[11px] text-text-muted">
          {folder.path_cache} · deletes in {daysLeft(folder.purge_after)}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onRestore} title="Restore">
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

function TrashDocRow({
  document,
  selected,
  active,
  onSelect,
  onClick,
  onRestore,
}: {
  document: Document;
  selected: boolean;
  active: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onClick: (id: string) => void;
  onRestore: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
        active ? "bg-surface-muted" : "hover:bg-surface-hover"
      }`}
      onClick={() => onClick(document.id)}
    >
      <span onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={(c) => onSelect(document.id, !!c)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-text-primary">{document.title}</p>
        <p className="truncate text-[11px] text-text-muted">
          {document.trashed_at ? formatDate(document.trashed_at) : "—"} · deletes in{" "}
          {daysLeft(document.purge_after)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={(e) => {
          e.stopPropagation();
          onRestore();
        }}
        title="Restore"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}
