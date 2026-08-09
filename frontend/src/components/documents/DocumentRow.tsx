import {
  FileText,
  FileImage,
  File,
  FileSpreadsheet,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { Document } from "@/lib/api/types";
import { Checkbox } from "@/components/ui/Checkbox";
import { TagList } from "@/components/tags/TagList";

interface DocumentRowProps {
  document: Document;
  selected: boolean;
  active: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onClick: (id: string) => void;
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
  onSelect,
  onClick,
}: DocumentRowProps) {
  return (
    <tr
      onClick={() => onClick(document.id)}
      className={cn(
        "cursor-pointer border-b border-surface-border transition-colors",
        active && "bg-row-selected border-l-2 border-l-accent",
        !active && selected && "bg-row-selected/60",
        !active && !selected && "hover:bg-surface-hover",
      )}
    >
      <td className="w-8 px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(document.id, !!checked)}
        />
      </td>
      <td className="max-w-[240px] px-2 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon mimeType={document.mime_type} />
          <span className="truncate font-medium text-text-primary">{document.title}</span>
        </div>
      </td>
      <td className="hidden lg:table-cell max-w-[120px] px-2 py-2">
        <span className="truncate text-text-secondary text-xs">
          {document.folder_path?.split(" / ").pop() ?? "—"}
        </span>
      </td>
      <td className="hidden md:table-cell max-w-[160px] px-2 py-2">
        <TagList tags={document.tags} max={2} />
      </td>
      <td className="hidden xl:table-cell px-2 py-2 text-text-secondary text-xs">
        {document.document_type_name ?? "—"}
      </td>
      <td className="w-24 px-2 py-2 text-right text-text-secondary text-xs whitespace-nowrap">
        {formatDate(document.added_date)}
      </td>
    </tr>
  );
}
