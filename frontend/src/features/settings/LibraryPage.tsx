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
  Info,
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

function KpiCard({
  label,
  value,
  icon: Icon,
  iconColour,
  compact,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
  iconColour: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        compact ? "min-h-[68px]" : "min-h-[72px]",
      )}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center"
        style={{ color: iconColour }}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium leading-4 text-[#64748B]">{label}</p>
        <p className="text-[20px] font-bold leading-6 text-[#0F172A]">{value}</p>
      </div>
    </div>
  );
}

function UsageBar({ percent }: { percent: number }) {
  return (
    <div className="h-1 w-[54px] overflow-hidden rounded-full bg-[#E2E8F0]">
      <div
        className="h-full rounded-full bg-[#0D9488]"
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
    return <p className="text-text-muted">Loading library insights…</p>;
  }
  if (error || !data) {
    return <p role="alert" className="text-danger">Library insights are unavailable.</p>;
  }

  const { activity, snapshot, file_types, health } = data;

  return (
    <div className="mx-auto max-w-[1180px] bg-[#F8FAFC] pb-10 pt-7 px-7">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold leading-7 text-[#0F172A]">Library</h1>
          <p className="mt-0.5 text-[13px] leading-5 text-[#64748B]">
            Historical activity, current library insights, file types, and tag administration.
          </p>
        </div>
        <Button
          variant="secondary"
          className="h-8 border-[#E2E8F0] px-3 text-[12px] font-semibold"
          disabled={resetStats.isPending}
          onClick={() => void resetStats.mutateAsync()}
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
          Reset statistics
        </Button>
      </header>

      <section className="mb-7">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-[15px] font-bold leading-[22px] text-[#0F172A]">
            1. Library Activity
          </h2>
          <span className="text-[12px] text-[#64748B]">Since {activity.since_label}</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Documents ingested" value={activity.documents_ingested.toLocaleString()} icon={FileText} iconColour="#0D9488" />
          <KpiCard label="Data ingested" value={formatBytes(activity.bytes_ingested)} icon={Database} iconColour="#0D9488" />
          <KpiCard label="Pages processed" value={activity.pages_processed.toLocaleString()} icon={Files} iconColour="#0D9488" />
          <KpiCard label="Successful processing" value={activity.successful_processing.toLocaleString()} icon={CircleCheck} iconColour="#059669" />
        </div>
        <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard compact label="OCR pages" value={activity.ocr_pages.toLocaleString()} icon={ScanLine} iconColour="#64748B" />
          <KpiCard compact label="Failed documents" value={activity.failed_documents.toLocaleString()} icon={CircleAlert} iconColour="#DC2626" />
          <KpiCard compact label="Duplicates rejected" value={activity.duplicates_rejected.toLocaleString()} icon={Copy} iconColour="#64748B" />
          <KpiCard compact label="Purged documents" value={activity.purged_documents.toLocaleString()} icon={Trash2} iconColour="#64748B" />
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-[#64748B]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Historical counters since last reset. Values do not decrease when documents are deleted.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-[15px] font-bold leading-[22px] text-[#0F172A]">
          2. Current Library Snapshot
        </h2>
        <div className="mt-3 grid min-h-[62px] grid-cols-2 divide-x divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] bg-white sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Current documents", value: snapshot.current_documents.toLocaleString(), icon: FileText },
            { label: "Library size", value: formatBytes(snapshot.library_size_bytes), icon: Database },
            { label: "Folders", value: snapshot.folders.toLocaleString(), icon: Folder },
            { label: "Tags", value: snapshot.tags.toLocaleString(), icon: Tag },
            { label: "Archived", value: snapshot.archived.toLocaleString(), icon: Archive },
            { label: "Unprocessed", value: snapshot.unprocessed.toLocaleString(), icon: LoaderCircle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2.5 px-3 py-3">
              <Icon className="h-[18px] w-[18px] shrink-0 text-[#64748B]" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-[11px] text-[#64748B]">{label}</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-7 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section>
          <h2 className="text-[15px] font-bold leading-[22px] text-[#0F172A]">
            3. File Type Breakdown
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-white">
                  {["Type", "Documents", "Size", "% of library", "Usage"].map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-[11px] font-semibold leading-4 text-[#64748B]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fileTypeItems.map((row) => (
                  <tr key={row.mime_type || row.type} className="border-b border-[#E2E8F0] last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#334155]">
                        <FileText className="h-4 w-4" style={{ color: row.icon_colour }} strokeWidth={1.75} />
                        {row.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-medium text-[#334155]">
                      {row.documents.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-medium text-[#334155]">
                      {formatBytes(row.size_bytes)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-medium text-[#334155]">
                      {row.percentage.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5">
                      <UsageBar percent={row.usage_percent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {file_types.total_types > 6 && (
              <button
                type="button"
                className="flex h-9 w-full items-center gap-1 px-3 text-[11px] font-semibold text-[#0F766E] hover:bg-[#F8FAFC]"
                onClick={() => setShowAllFileTypes((v) => !v)}
              >
                View all file types ({file_types.total_types})
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-[15px] font-bold leading-[22px] text-[#0F172A]">4. Library Health</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
            {[
              {
                key: "needs_processing",
                label: "Needs processing",
                description: "Documents awaiting processing",
                count: health.needs_processing,
                icon: LoaderCircle,
                iconColour: "#64748B",
                onClick: () => navigate("/documents?unprocessed=true"),
              },
              {
                key: "failed",
                label: "Failed documents",
                description: "Require review or reprocessing",
                count: health.failed_documents,
                icon: CircleAlert,
                iconColour: "#DC2626",
                onClick: () => navigate("/inbox?view=work"),
              },
              {
                key: "missing_text",
                label: "Missing text",
                description: "Files with no extracted text",
                count: health.missing_text,
                icon: ScanText,
                iconColour: "#64748B",
                onClick: undefined,
              },
              {
                key: "unused_tags",
                label: "Unused tags",
                description: "Tags with no associated documents",
                count: health.unused_tags,
                icon: Tag,
                iconColour: "#16A34A",
                onClick: undefined,
              },
              {
                key: "duplicates",
                label: "Duplicate content",
                description: "Rejected at ingest (same checksum)",
                count: health.duplicate_content,
                icon: Copy,
                iconColour: "#64748B",
                onClick: undefined,
              },
              {
                key: "empty_folders",
                label: "Empty folders",
                description: "Folders with no documents",
                count: health.empty_folders,
                icon: FolderOpen,
                iconColour: "#64748B",
                onClick: undefined,
              },
            ]            .map((row) => {
              const Icon = row.icon;
              const isLink = !!row.onClick;
              const inner = (
                <>
                  <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: row.iconColour }} strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[#0F172A]">{row.label}</p>
                    <p className="text-[10px] text-[#64748B]">{row.description}</p>
                  </div>
                  <span className="text-[12px] font-semibold text-[#334155]">{row.count.toLocaleString()}</span>
                  {isLink && <ChevronRight className="h-4 w-4 text-[#64748B]" strokeWidth={1.75} />}
                </>
              );
              return isLink ? (
                <button
                  key={row.key}
                  type="button"
                  className="grid w-full min-h-12 grid-cols-[28px_1fr_auto_16px] items-center gap-2 border-b border-[#E2E8F0] px-3 py-2 text-left last:border-0 hover:bg-[#F8FAFC]"
                  onClick={row.onClick}
                >
                  {inner}
                </button>
              ) : (
                <div
                  key={row.key}
                  className="grid min-h-12 grid-cols-[28px_1fr_auto] items-center gap-2 border-b border-[#E2E8F0] px-3 py-2 last:border-0"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section>
        <h2 className="text-[15px] font-bold leading-[22px] text-[#0F172A]">5. Tag Management</h2>
        <div className="mt-3 mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" strokeWidth={1.75} />
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
                variant="secondary"
                className="h-8 border-[#E2E8F0] px-3 text-[12px] font-semibold text-[#DC2626]"
                onClick={() => openTagDialog({ type: "delete-unused" })}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                Delete unused tags
              </Button>
            )}
            <Button
              className="h-8 bg-[#0F766E] px-3 text-[12px] font-semibold hover:bg-[#115E59]"
              onClick={() => openTagDialog({ type: "new" })}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New tag
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                {["Colour", "Tag name", "Documents", "Actions"].map((col, i) => (
                  <th
                    key={col}
                    className={cn(
                      "px-3 py-2 text-[11px] font-semibold text-[#64748B]",
                      i === 3 && "text-right",
                    )}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTags.map((tag) => (
                <tr key={tag.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-[3px] border border-[rgba(15,23,42,0.08)]"
                      style={{ backgroundColor: tag.color }}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-[12px] font-medium text-[#334155]">{tag.name}</td>
                  <td className="px-3 py-2.5 text-[12px] font-medium text-[#334155]">
                    {tag.document_count.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {[
                        { action: "edit" as const, icon: Pencil, colour: "#475569" },
                        { action: "merge" as const, icon: GitMerge, colour: "#475569" },
                        { action: "delete" as const, icon: Trash2, colour: "#DC2626" },
                      ].map(({ action, icon: Icon, colour }) => (
                        <button
                          key={action}
                          type="button"
                          aria-label={`${action} tag ${tag.name}`}
                          className="flex h-7 w-[30px] items-center justify-center rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                          style={{ color: colour }}
                          onClick={() => openTagDialog({ type: action, tag })}
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
                      tagColor === c ? "ring-2 ring-accent ring-offset-1" : "border-[rgba(15,23,42,0.08)]",
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
              {tagDialog?.type === "delete" || tagDialog?.type === "delete-unused" ? "Delete" : tagDialog?.type === "merge" ? "Merge" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
