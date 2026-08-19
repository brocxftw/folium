import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  CircleAlert,
  CircleCheck,
  Copy,
  Database,
  FileText,
  Files,
  Folder,
  FolderOpen,
  GitMerge,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  ScanLine,
  ScanText,
  Search,
  Tag,
  Trash2,
  ChevronRight,
} from "lucide-react";
import {
  useCreateTag,
  useDeleteTag,
  useLibraryOverview,
  useMergeTags,
  useResetLibraryStatistics,
  useUpdateTag,
} from "@/lib/api/hooks";
import type { LibraryFileType, Tag as TagType } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { TAG_COLOR_PRESETS } from "@/components/tags/TagList";
import { cn, formatBytes } from "@/lib/utils";
import {
  SettingsCard,
  SettingsContent,
  SettingsEmptyState,
  SettingsInfoBanner,
  SettingsMetricCard,
  SettingsPageHeader,
  SettingsSection,
  SettingsTable,
  SettingsTableBody,
  SettingsTableCell,
  SettingsTableHead,
  SettingsTableHeaderCell,
  SettingsTableRow,
} from "@/features/settings/components";

function UsageBar({ percent }: { percent: number }) {
  return (
    <div className="h-1 w-[54px] overflow-hidden rounded-full bg-surface-border">
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

type TagDialog =
  | { type: "new" }
  | { type: "edit"; tag: TagType }
  | { type: "merge"; tag: TagType }
  | { type: "delete"; tag: TagType }
  | { type: "delete-unused" }
  | null;

export function LibraryPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useLibraryOverview();
  const resetStats = useResetLibraryStatistics();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const mergeTags = useMergeTags();

  const [showAllFileTypes, setShowAllFileTypes] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [tagSort, setTagSort] = useState<"name" | "documents">("name");
  const [tagDialog, setTagDialog] = useState<TagDialog>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState<string>(TAG_COLOR_PRESETS[0]);
  const [mergeTargetId, setMergeTargetId] = useState("");

  const filteredTags = useMemo(() => {
    const tags = data?.tags ?? [];
    const q = tagSearch.trim().toLowerCase();
    const filtered = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
    return [...filtered].sort((a, b) =>
      tagSort === "name"
        ? a.name.localeCompare(b.name)
        : b.document_count - a.document_count,
    );
  }, [data?.tags, tagSearch, tagSort]);

  const fileTypeItems: LibraryFileType[] = useMemo(() => {
    const items = data?.file_types.items ?? [];
    if (showAllFileTypes || items.length <= 6) return items;
    return items.slice(0, 6);
  }, [data?.file_types.items, showAllFileTypes]);

  const openTagDialog = (dialog: TagDialog) => {
    if (dialog?.type === "edit" || dialog?.type === "merge" || dialog?.type === "delete") {
      setTagName(dialog.tag.name);
      setTagColor(dialog.tag.color);
      if (dialog.type === "merge") setMergeTargetId("");
    } else if (dialog?.type === "new") {
      setTagName("");
      setTagColor(TAG_COLOR_PRESETS[0]);
    }
    setTagDialog(dialog);
  };

  const submitTagDialog = async () => {
    if (!tagDialog) return;
    if (tagDialog.type === "new") {
      await createTag.mutateAsync({ name: tagName.trim(), color: tagColor });
    } else if (tagDialog.type === "edit") {
      await updateTag.mutateAsync({
        id: tagDialog.tag.id,
        data: { name: tagName.trim(), color: tagColor },
      });
    } else if (tagDialog.type === "merge" && mergeTargetId) {
      await mergeTags.mutateAsync({
        source_tag_id: tagDialog.tag.id,
        target_tag_id: mergeTargetId,
      });
    } else if (tagDialog.type === "delete") {
      await deleteTag.mutateAsync(tagDialog.tag.id);
    } else if (tagDialog.type === "delete-unused") {
      const unused = (data?.tags ?? []).filter((t) => t.document_count === 0);
      for (const t of unused) {
        await deleteTag.mutateAsync(t.id);
      }
    }
    setTagDialog(null);
  };

  if (isLoading) {
    return (
      <SettingsContent width="wide">
        <SettingsEmptyState>Loading library insights…</SettingsEmptyState>
      </SettingsContent>
    );
  }
  if (error || !data) {
    return (
      <SettingsContent width="wide">
        <p role="alert" className="text-danger">
          Library insights are unavailable.
        </p>
      </SettingsContent>
    );
  }

  const { activity, snapshot, file_types, health } = data;

  return (
    <SettingsContent width="wide">
      <SettingsPageHeader
        title="Library"
        description="Review your library activity, file composition, health and tags."
        actions={
          <Button
            variant="outline"
            disabled={resetStats.isPending}
            onClick={() => void resetStats.mutateAsync()}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
            Reset statistics
          </Button>
        }
      />

      <SettingsSection
        title="Library activity"
        description={`Since ${activity.since_label}`}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SettingsMetricCard label="Documents ingested" value={activity.documents_ingested.toLocaleString()} icon={FileText} />
          <SettingsMetricCard label="Data ingested" value={formatBytes(activity.bytes_ingested)} icon={Database} />
          <SettingsMetricCard label="Pages processed" value={activity.pages_processed.toLocaleString()} icon={Files} />
          <SettingsMetricCard label="Successful processing" value={activity.successful_processing.toLocaleString()} icon={CircleCheck} />
          <SettingsMetricCard compact label="OCR pages" value={activity.ocr_pages.toLocaleString()} icon={ScanLine} />
          <SettingsMetricCard
            compact
            label="Failed documents"
            value={activity.failed_documents.toLocaleString()}
            icon={CircleAlert}
            tone="danger"
          />
          <SettingsMetricCard compact label="Duplicates rejected" value={activity.duplicates_rejected.toLocaleString()} icon={Copy} />
          <SettingsMetricCard compact label="Purged documents" value={activity.purged_documents.toLocaleString()} icon={Trash2} />
        </div>
        <SettingsInfoBanner tone="muted">
          Historical counters since last reset. Values do not decrease when documents are deleted.
        </SettingsInfoBanner>
      </SettingsSection>

      <SettingsSection title="Current library">
        <SettingsCard padding="none">
          <div className="grid grid-cols-2 divide-x divide-surface-border sm:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Current documents", value: snapshot.current_documents.toLocaleString(), icon: FileText },
              { label: "Library size", value: formatBytes(snapshot.library_size_bytes), icon: Database },
              { label: "Folders", value: snapshot.folders.toLocaleString(), icon: Folder },
              { label: "Tags", value: snapshot.tags.toLocaleString(), icon: Tag },
              { label: "Archived", value: snapshot.archived.toLocaleString(), icon: Archive },
              { label: "Unprocessed", value: snapshot.unprocessed.toLocaleString(), icon: LoaderCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2.5 px-3 py-3">
                <Icon className="h-[18px] w-[18px] shrink-0 text-text-secondary" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-[11px] text-text-secondary">{label}</p>
                  <p className="text-[13px] font-bold text-text-primary">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
      </SettingsSection>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SettingsSection title="File type breakdown">
          <SettingsTable minWidth="480px">
            <SettingsTableHead>
              {["Type", "Documents", "Size", "% of library", "Usage"].map((col) => (
                <SettingsTableHeaderCell key={col}>{col}</SettingsTableHeaderCell>
              ))}
            </SettingsTableHead>
            <SettingsTableBody>
              {fileTypeItems.map((row) => (
                <SettingsTableRow key={row.mime_type || row.type}>
                  <SettingsTableCell>
                    <span className="inline-flex items-center gap-2 font-medium">
                      <FileText className="h-4 w-4" style={{ color: row.icon_colour }} strokeWidth={1.75} />
                      {row.type}
                    </span>
                  </SettingsTableCell>
                  <SettingsTableCell className="font-medium">
                    {row.documents.toLocaleString()}
                  </SettingsTableCell>
                  <SettingsTableCell className="font-medium">{formatBytes(row.size_bytes)}</SettingsTableCell>
                  <SettingsTableCell className="font-medium">{row.percentage.toFixed(1)}%</SettingsTableCell>
                  <SettingsTableCell>
                    <UsageBar percent={row.usage_percent} />
                  </SettingsTableCell>
                </SettingsTableRow>
              ))}
            </SettingsTableBody>
          </SettingsTable>
          {file_types.total_types > 6 && (
            <button
              type="button"
              className="flex h-9 w-full items-center gap-1 px-1 text-[11px] font-semibold text-accent hover:underline"
              onClick={() => setShowAllFileTypes((v) => !v)}
            >
              {showAllFileTypes ? "Show fewer file types" : `View all file types (${file_types.total_types})`}
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </SettingsSection>

        <SettingsSection title="Library health">
          <SettingsCard padding="none">
            {[
              {
                key: "needs_processing",
                label: "Needs processing",
                description: "Documents awaiting processing",
                count: health.needs_processing,
                icon: LoaderCircle,
                tone: "neutral" as const,
                onClick: () => navigate("/documents?unprocessed=true"),
              },
              {
                key: "failed",
                label: "Failed documents",
                description: "Require review or reprocessing",
                count: health.failed_documents,
                icon: CircleAlert,
                tone: "danger" as const,
                onClick: () => navigate("/inbox?view=work"),
              },
              {
                key: "missing_text",
                label: "Missing text",
                description: "Files with no extracted text",
                count: health.missing_text,
                icon: ScanText,
                tone: "neutral" as const,
                onClick: undefined,
              },
              {
                key: "unused_tags",
                label: "Unused tags",
                description: "Tags with no associated documents",
                count: health.unused_tags,
                icon: Tag,
                tone: "neutral" as const,
                onClick: undefined,
              },
              {
                key: "duplicates",
                label: "Duplicate content",
                description: "Rejected at ingest (same checksum)",
                count: health.duplicate_content,
                icon: Copy,
                tone: "neutral" as const,
                onClick: undefined,
              },
              {
                key: "empty_folders",
                label: "Empty folders",
                description: "Folders with no documents",
                count: health.empty_folders,
                icon: FolderOpen,
                tone: "neutral" as const,
                onClick: undefined,
              },
            ].map((row) => {
              const Icon = row.icon;
              const isLink = !!row.onClick;
              const iconClass = row.tone === "danger" && row.count > 0 ? "text-danger" : "text-text-secondary";
              const inner = (
                <>
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", iconClass)} strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-text-primary">{row.label}</p>
                    <p className="text-[10px] text-text-secondary">{row.description}</p>
                  </div>
                  <span className="text-[12px] font-semibold text-text-primary">{row.count.toLocaleString()}</span>
                  {isLink && <ChevronRight className="h-4 w-4 text-text-muted" strokeWidth={1.75} />}
                </>
              );
              return isLink ? (
                <button
                  key={row.key}
                  type="button"
                  className="grid w-full min-h-12 grid-cols-[28px_1fr_auto_16px] items-center gap-2 border-b border-surface-border px-3 py-2 text-left last:border-0 hover:bg-surface-hover"
                  onClick={row.onClick}
                >
                  {inner}
                </button>
              ) : (
                <div
                  key={row.key}
                  className="grid min-h-12 grid-cols-[28px_1fr_auto] items-center gap-2 border-b border-surface-border px-3 py-2 last:border-0"
                >
                  {inner}
                </div>
              );
            })}
          </SettingsCard>
        </SettingsSection>
      </div>

      <SettingsSection title="Tag management">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
              <Input
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Search tags..."
                className="h-[34px] pl-8 text-[12px]"
              />
            </div>
            <Select value={tagSort} onValueChange={(v) => setTagSort(v as "name" | "documents")}>
              <SelectTrigger className="h-[34px] w-[150px] text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort by name</SelectItem>
                <SelectItem value="documents">Sort by documents</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {(data?.tags ?? []).some((t) => t.document_count === 0) && (
              <Button
                variant="outline"
                className="text-danger"
                onClick={() => openTagDialog({ type: "delete-unused" })}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                Delete unused tags
              </Button>
            )}
            <Button onClick={() => openTagDialog({ type: "new" })}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New tag
            </Button>
          </div>
        </div>

        <SettingsTable minWidth="560px">
          <SettingsTableHead>
            {["Colour", "Tag name", "Documents", "Actions"].map((col, i) => (
              <SettingsTableHeaderCell key={col} className={i === 3 ? "text-right" : undefined}>
                {col}
              </SettingsTableHeaderCell>
            ))}
          </SettingsTableHead>
          <SettingsTableBody>
            {filteredTags.map((tag) => (
              <SettingsTableRow key={tag.id} className="hover:bg-surface-hover">
                <SettingsTableCell>
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-[3px] border border-surface-border"
                    style={{ backgroundColor: tag.color }}
                  />
                </SettingsTableCell>
                <SettingsTableCell className="font-medium">{tag.name}</SettingsTableCell>
                <SettingsTableCell className="font-medium">{tag.document_count.toLocaleString()}</SettingsTableCell>
                <SettingsTableCell>
                  <div className="flex justify-end gap-1.5">
                    {[
                      { action: "edit" as const, icon: Pencil, destructive: false },
                      { action: "merge" as const, icon: GitMerge, destructive: false },
                      { action: "delete" as const, icon: Trash2, destructive: true },
                    ].map(({ action, icon: Icon, destructive }) => (
                      <button
                        key={action}
                        type="button"
                        aria-label={`${action} tag ${tag.name}`}
                        className={cn(
                          "flex h-7 w-[30px] items-center justify-center rounded-md border border-surface-border bg-surface hover:bg-surface-hover",
                          destructive ? "text-danger" : "text-text-secondary",
                        )}
                        onClick={() => openTagDialog({ type: action, tag })}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    ))}
                  </div>
                </SettingsTableCell>
              </SettingsTableRow>
            ))}
          </SettingsTableBody>
        </SettingsTable>
      </SettingsSection>

      <Dialog open={tagDialog !== null} onOpenChange={(open) => !open && setTagDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tagDialog?.type === "new" && "New tag"}
              {tagDialog?.type === "edit" && "Edit tag"}
              {tagDialog?.type === "merge" && "Merge tag"}
              {tagDialog?.type === "delete" && "Delete tag"}
              {tagDialog?.type === "delete-unused" && "Delete unused tags"}
            </DialogTitle>
            {tagDialog?.type === "delete" && (
              <DialogDescription>
                Delete &ldquo;{tagDialog.tag.name}&rdquo;? This removes the tag from all documents.
              </DialogDescription>
            )}
            {tagDialog?.type === "delete-unused" && (
              <DialogDescription>
                Delete {(data?.tags ?? []).filter((t) => t.document_count === 0).length} tags
                with no associated documents? This cannot be undone.
              </DialogDescription>
            )}
            {tagDialog?.type === "merge" && (
              <DialogDescription>
                Merge &ldquo;{tagDialog.tag.name}&rdquo; into another tag. Documents will keep the target tag.
              </DialogDescription>
            )}
          </DialogHeader>

          {(tagDialog?.type === "new" || tagDialog?.type === "edit") && (
            <div className="space-y-3">
              <Input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="Tag name" />
              <div className="flex flex-wrap gap-2">
                {TAG_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-6 w-6 rounded-[3px] border",
                      tagColor === c ? "ring-2 ring-accent ring-offset-1" : "border-surface-border",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setTagColor(c)}
                  />
                ))}
              </div>
            </div>
          )}

          {tagDialog?.type === "merge" && (
            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target tag" />
              </SelectTrigger>
              <SelectContent>
                {filteredTags
                  .filter((t) => t.id !== tagDialog.tag.id)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setTagDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={tagDialog?.type === "delete" || tagDialog?.type === "delete-unused" ? "danger" : "default"}
              disabled={
                (tagDialog?.type === "new" && !tagName.trim()) ||
                (tagDialog?.type === "merge" && !mergeTargetId) ||
                createTag.isPending ||
                updateTag.isPending ||
                deleteTag.isPending ||
                mergeTags.isPending
              }
              onClick={() => void submitTagDialog()}
            >
              {tagDialog?.type === "delete" || tagDialog?.type === "delete-unused"
                ? "Delete"
                : tagDialog?.type === "merge"
                  ? "Merge"
                  : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsContent>
  );
}
