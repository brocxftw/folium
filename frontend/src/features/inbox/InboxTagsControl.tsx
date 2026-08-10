import { DocumentTagsControl } from "@/components/tags/DocumentTagsControl";
import type { Document } from "@/lib/api/types";

interface InboxTagsControlProps {
  document: Document;
  stopPropagation?: boolean;
}

/** Inbox table/preview wrapper around shared document tag editor. */
export function InboxTagsControl({ document, stopPropagation }: InboxTagsControlProps) {
  return (
    <DocumentTagsControl
      document={document}
      stopPropagation={stopPropagation}
      maxVisible={4}
    />
  );
}
