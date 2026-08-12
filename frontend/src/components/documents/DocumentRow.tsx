import {
  FileText,
  FileImage,
  File,
  FileSpreadsheet,
} from "lucide-react";
import type { DragEvent } from "react";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import type { Document, Folder, Tag as TagType } from "@/lib/api/types";
import { Checkbox } from "@/components/ui/Checkbox";
import { TagList } from "@/components/tags/TagList";
import { DocumentActionsMenu } from "@/features/documents/DocumentActionsMenu";
import { RetrievalReadinessBadge } from "@/features/documents/RetrievalReadinessBadge";
import { setDocumentDragData, clearDocumentDragData } from "@/features/documents/documentDrag";

interface DocumentRowProps {
  document: Document;
  selected: boolean;
  active: boolean;
  focused?: boolean;
  selectedIds: Set<string>;
  folders?: Folder[];
  tags?: TagType[];
  onCheckbox: (id: string, checked: boolean) => void;
  onRowPointer: (
    id: string,
    event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  ) => void;
  onOpen: (id: string) => void;
  onFocusRow: (id: string) => void;
  onActionComplete?: () => void;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  return <File className="h-4 w-4 text-text-muted" />;
}

export function DocumentRow({
  document,
  selected,
  active,
  focused,
  selectedIds,
  folders,
  tags,
  onCheckbox,
  onRowPointer,
  onOpen,
  onFocusRow,
  onActionComplete,
}: DocumentRowProps) {
  const handleDragStart = (event: DragEvent) => {
    const ids = selectedIds.has(document.id)
      ? Array.from(selectedIds)
      : [document.id];
    setDocumentDragData(event.dataTransfer, ids);
  };

  return (
    <tr
      role="row"
      aria-selected={selected}
      tabIndex={-1}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => clearDocumentDragData()}
      onFocus={() => onFocusRow(document.id)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-row-checkbox]")) return;
        if ((event.target as HTMLElement).closest("[data-document-actions]")) return;
        onRowPointer(document.id, {
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
        });
      }}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-document-actions]")) return;
        onOpen(document.id);
      }}
      className={cn(
        "group cursor-pointer border-b border-surface-border outline-none transition-colors",
        active && "bg-row-selected border-l-2 border-l-accent",
        !active && selected && "bg-row-selected/60",
        !active && !selected && "hover:bg-surface-hover",
        focused && "ring-1 ring-inset ring-focus",
      )}
    >
      <td
        className="w-8 px-2 py-2"
        data-row-checkbox
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onCheckbox(document.id, !!checked)}
          aria-label={`Select ${document.title}`}
        />
      </td>
      <td className="max-w-[280px] px-2 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileIcon mimeType={document.mime_type} />
          <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
            {document.title}
          </span>
          <DocumentActionsMenu
            document={document}
            folders={folders}
            tags={tags}
            onActionComplete={onActionComplete}
          />
        </div>
      </td>
      <td className="hidden max-w-[120px] px-2 py-2 lg:table-cell">
        <span className="truncate text-xs text-text-secondary">
          {document.folder_path?.split(" / ").pop() ?? "—"}
        </span>
      </td>
      <td className="hidden max-w-[160px] px-2 py-2 md:table-cell">
        <TagList tags={document.tags} max={2} />
      </td>
      <td className="hidden whitespace-nowrap px-2 py-2 text-xs text-text-secondary xl:table-cell">
        {document.page_count != null ? `${document.page_count}p` : "—"}
        <span className="mx-1 text-text-muted">·</span>
        {formatBytes(document.file_size)}
      </td>
      <td className="hidden px-2 py-2 sm:table-cell">
        <RetrievalReadinessBadge document={document} />
      </td>
      <td className="w-24 whitespace-nowrap px-2 py-2 text-right text-xs text-text-secondary">
        {formatDate(document.added_date)}
      </td>
    </tr>
  );
}
