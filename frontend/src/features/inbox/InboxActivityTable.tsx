import {
  AlertCircle,
  Check,
  Clock3,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreVertical,
  Eye,
  FolderInput,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { Document } from "@/lib/api/types";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { TagList } from "@/components/tags/TagList";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import {
  fileTypeLabel,
  presentationLabel,
  processedAtValue,
  toPresentationStatus,
  type PresentationStatus,
} from "./inboxPresentation";

const BADGE_STYLES: Record<
  PresentationStatus,
  { className: string; icon: typeof Check }
> = {
  processed: {
    className: "bg-[#E8F7EF] text-[#198754]",
    icon: Check,
  },
  failed: {
    className: "bg-[#FDEBEC] text-[#C6474A]",
    icon: AlertCircle,
  },
  processing: {
    className: "bg-[#EAF3FE] text-[#2D6DB5]",
    icon: Loader2,
  },
  queued: {
    className: "bg-[#FFF2E3] text-[#B86B1D]",
    icon: Clock3,
  },
  needs_review: {
    className: "bg-[#FFF7DD] text-[#9D6A12]",
    icon: AlertCircle,
  },
};

function FileTypeIcon({ doc }: { doc: Document }) {
  const mime = doc.mime_type;
  const className = "h-4 w-4 shrink-0 text-[#5D6B76]";
  if (mime === "application/pdf" || mime.startsWith("text/")) {
    return <FileText className={className} strokeWidth={1.75} />;
  }
  if (mime.startsWith("image/")) {
    return <FileImage className={className} strokeWidth={1.75} />;
  }
  if (mime.includes("sheet") || mime === "text/csv") {
    return <FileSpreadsheet className={className} strokeWidth={1.75} />;
  }
  return <File className={className} strokeWidth={1.75} />;
}

function PresentationBadge({ doc }: { doc: Document }) {
  const status = toPresentationStatus(doc);
  if (!status) return <span className="text-xs text-text-muted">—</span>;
  const style = BADGE_STYLES[status];
  const Icon = style.icon;
  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
        style.className,
      )}
    >
      <Icon
        className={cn("h-3 w-3", status === "processing" && "animate-spin")}
        strokeWidth={1.75}
      />
      {presentationLabel(status)}
    </span>
  );

  if (status === "failed" && doc.processing_error) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-[280px] text-[10px]">
          {doc.processing_error}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "needs_review") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-[280px] text-[10px]">
          Assign a folder or complete missing filing fields
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}

interface InboxActivityTableProps {
  documents: Document[];
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onPreview: (id: string) => void;
  onOpenWork: () => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  isLoading?: boolean;
  empty?: React.ReactNode;
}

export function InboxActivityTable({
  documents,
  selectedIds,
  onSelect,
  onPreview,
  onOpenWork,
  onRetry,
  onRemove,
  isLoading,
  empty,
}: InboxActivityTableProps) {
  const allSelected = documents.length > 0 && documents.every((d) => selectedIds.has(d.id));

  const toggleAll = () => {
    if (allSelected) onSelect(new Set());
    else onSelect(new Set(documents.map((d) => d.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelect(next);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-text-muted">
        Loading activity…
      </div>
    );
  }

  if (documents.length === 0) {
    return <div className="flex flex-1 items-center justify-center p-8">{empty}</div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-[#F8FAFB]">
          <tr className="h-10 border-b border-[#EDF1F3] text-left text-[11px] font-semibold text-[#5D6B76]">
            <th className="w-[42px] px-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </th>
            <th className="px-3 font-semibold">Document</th>
            <th className="px-3 font-semibold">Status</th>
            <th className="px-3 font-semibold">Type</th>
            <th className="px-3 font-semibold">Size</th>
            <th className="px-3 font-semibold">Uploaded</th>
            <th className="px-3 font-semibold">Processed at</th>
            <th className="px-3 font-semibold">Tags</th>
            <th className="w-[120px] px-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const selected = selectedIds.has(doc.id);
            const processedAt = processedAtValue(doc);
            return (
              <tr
                key={doc.id}
                className={cn(
                  "h-[58px] border-b border-[#EDF1F3] hover:bg-[#FAFCFD]",
                  selected && "bg-[#F0FBF9]",
                )}
              >
                <td className="px-3">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggleOne(doc.id)}
                    aria-label={`Select ${doc.original_filename}`}
                  />
                </td>
                <td className="px-3">
                  <button
                    type="button"
                    className="flex max-w-xs items-start gap-2 text-left"
                    onClick={() => onPreview(doc.id)}
                  >
                    <span className="mt-0.5">
                      <FileTypeIcon doc={doc} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-[#14212B]">
                        {doc.original_filename}
                      </span>
                      <span className="block truncate text-[11px] text-[#74828D]">
                        {doc.title !== doc.original_filename ? doc.title : "Added to Inbox"}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="px-3">
                  <PresentationBadge doc={doc} />
                </td>
                <td className="px-3 text-xs text-[#42515D]">{fileTypeLabel(doc)}</td>
                <td className="px-3 text-xs text-[#42515D]">{formatBytes(doc.file_size)}</td>
                <td className="px-3 text-xs text-[#42515D]">{formatDateTime(doc.added_date)}</td>
                <td className="px-3 text-xs text-[#42515D]">
                  {processedAt ? formatDateTime(processedAt) : "—"}
                </td>
                <td className="px-3">
                  {doc.tags.length > 0 ? (
                    <TagList tags={doc.tags} max={2} />
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </td>
                <td className="px-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-[30px] w-[30px] text-[#5D6B76]"
                      aria-label="View document"
                      onClick={() => onPreview(doc.id)}
                    >
                      <Eye className="h-4 w-4" strokeWidth={1.75} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-[30px] w-[30px] text-[#5D6B76]"
                      aria-label="Open review workspace"
                      onClick={onOpenWork}
                    >
                      <FolderInput className="h-4 w-4" strokeWidth={1.75} />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-[30px] w-[30px] text-[#5D6B76]"
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onPreview(doc.id)}>
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onOpenWork}>
                          Open review workspace
                        </DropdownMenuItem>
                        {doc.inbox_status === "failed" && (
                          <DropdownMenuItem onClick={() => onRetry(doc.id)}>
                            <RotateCcw className="h-3.5 w-3.5" />
                            Retry
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-danger"
                          onClick={() => onRemove(doc.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove from queue
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
