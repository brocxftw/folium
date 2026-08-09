import { Folder } from "lucide-react";
import { formatDate, formatDateTime, formatBytes } from "@/lib/utils";
import type { Document } from "@/lib/api/types";
import { useUpdateDocumentMetadata } from "@/lib/api/hooks";
import { TagList } from "@/components/tags/TagList";
import { ProcessingStatus } from "./ProcessingStatus";
import { AISummary } from "./AISummary";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

interface MetadataPanelProps {
  document: Document | undefined;
}

export function MetadataPanel({ document }: MetadataPanelProps) {
  const updateMeta = useUpdateDocumentMetadata();

  if (!document) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-sm text-text-muted">
        Select a document to view details
      </div>
    );
  }

  const saveField = (data: Parameters<typeof updateMeta.mutate>[0]["data"]) => {
    updateMeta.mutate({ id: document.id, data });
  };

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className="border-b border-surface-border px-4 py-3">
        <h3 className="font-medium text-text-primary truncate">{document.title}</h3>
        <p className="text-xs text-text-muted mt-0.5">
          {document.original_filename} · {formatBytes(document.file_size)}
        </p>
      </div>

      <div className="flex-1 space-y-5 p-4">
        <section>
          <label className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Title
          </label>
          <Input
            defaultValue={document.title}
            className="mt-1"
            onBlur={(e) => {
              if (e.target.value !== document.title) {
                saveField({ title: e.target.value });
              }
            }}
          />
        </section>

        <section>
          <label className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Folder
          </label>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-text-primary">
            <Folder className="h-3.5 w-3.5 text-text-muted" />
            <span>{document.folder_path ?? "—"}</span>
          </div>
        </section>

        <section>
          <label className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Tags
          </label>
          <div className="mt-1.5">
            <TagList tags={document.tags} />
          </div>
        </section>

        <section>
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-muted mb-2">
            Field Data
          </h4>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-text-secondary">Type</dt>
              <dd className="text-text-primary">{document.document_type_name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-secondary">Correspondent</dt>
              <dd className="text-text-primary">{document.correspondent_name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-secondary">Language</dt>
              <dd className="text-text-primary">{document.language ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-secondary">Pages</dt>
              <dd className="text-text-primary">{document.page_count ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-muted mb-2">
            Dates
          </h4>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-text-secondary">Created</dt>
              <dd className="text-text-primary">{formatDate(document.created_date)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-secondary">Added</dt>
              <dd className="text-text-primary">{formatDateTime(document.added_date)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-secondary">Modified</dt>
              <dd className="text-text-primary">{formatDateTime(document.modified_date)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <label className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Notes
          </label>
          <Textarea
            defaultValue={document.notes ?? ""}
            className="mt-1 min-h-[60px]"
            placeholder="Add notes…"
            onBlur={(e) => {
              const val = e.target.value || null;
              if (val !== document.notes) {
                saveField({ notes: val });
              }
            }}
          />
        </section>

        <ProcessingStatus document={document} />
        <AISummary document={document} />
      </div>
    </div>
  );
}
