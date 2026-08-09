import type { Document } from "@/lib/api/types";
import { useDocumentTypes, useUpdateDocumentMetadata } from "@/lib/api/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

interface InboxTypeControlProps {
  document: Document;
  stopPropagation?: boolean;
}

export function InboxTypeControl({ document: doc, stopPropagation }: InboxTypeControlProps) {
  const { data: types = [] } = useDocumentTypes();
  const update = useUpdateDocumentMetadata();

  return (
    <div onClick={(e) => stopPropagation && e.stopPropagation()}>
      <Select
        value={doc.document_type_id ?? "__none__"}
        onValueChange={(v) => {
          void update.mutateAsync({
            id: doc.id,
            data: { document_type_id: v === "__none__" ? null : v },
          });
        }}
      >
        <SelectTrigger className="h-7 w-[120px] text-xs border-transparent bg-transparent hover:bg-surface-hover">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">—</SelectItem>
          {types.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
