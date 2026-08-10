import { useMemo, useState } from "react";
import { Folder, RefreshCw, Sparkles, Tags } from "lucide-react";
import { formatBytes, formatDate, formatDateTime } from "@/lib/utils";
import type { Document } from "@/lib/api/types";
import {
  useDocumentContent,
  useJobs,
  useReprocessEmbeddings,
  useReprocessSuggestions,
  useRetryOcr,
  useRetryPreflight,
  useUpdateDocumentMetadata,
} from "@/lib/api/hooks";
import { TagList } from "@/components/tags/TagList";
import { ProcessingStatus } from "./ProcessingStatus";
import { AISummary } from "./AISummary";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
  getReadinessInfo,
  canAskDocument,
} from "@/features/documents/retrievalReadiness";
import { RetrievalReadinessBadge } from "@/features/documents/RetrievalReadinessBadge";
import { InboxSuggestions } from "@/features/inbox/InboxSuggestions";

interface DocumentInspectorProps {
  document: Document | undefined;
  defaultTab?: "overview" | "metadata" | "ocr";
}

export function DocumentInspector({
  document,
  defaultTab = "overview",
}: DocumentInspectorProps) {
  if (!document) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-sm text-text-muted">
        Select a document to view details
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-surface-border px-4 py-3">
        <h3 className="truncate font-medium text-text-primary">{document.title}</h3>
        <p className="mt-0.5 text-xs text-text-muted">
          {document.original_filename} · {formatBytes(document.file_size)}
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-surface-border px-3 pt-2">
          <TabsList className="h-8 w-full justify-start bg-transparent p-0">
            <TabsTrigger value="overview" className="h-7 px-2.5 text-xs">
              Overview
            </TabsTrigger>
            <TabsTrigger value="metadata" className="h-7 px-2.5 text-xs">
              Metadata
            </TabsTrigger>
            <TabsTrigger value="ocr" className="h-7 px-2.5 text-xs">
              OCR
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent
          value="overview"
          className="mt-0 min-h-0 flex-1 overflow-auto scrollbar-thin px-4 py-3"
        >
          <OverviewTab document={document} />
        </TabsContent>
        <TabsContent
          value="metadata"
          className="mt-0 min-h-0 flex-1 overflow-auto scrollbar-thin px-4 py-3"
        >
          <MetadataFields document={document} />
        </TabsContent>
        <TabsContent
          value="ocr"
          className="mt-0 min-h-0 flex-1 overflow-auto scrollbar-thin px-4 py-3"
        >
          <OcrTab document={document} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ document }: { document: Document }) {
  const readiness = getReadinessInfo(document);
  const { data: jobs = [] } = useJobs(undefined, document.id);
  const reprocessEmbeddings = useReprocessEmbeddings();
  const reprocessSuggestions = useReprocessSuggestions();
  const recentJobs = useMemo(
    () =>
      [...jobs]
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 8),
    [jobs],
  );
  const busy = reprocessEmbeddings.isPending || reprocessSuggestions.isPending;
  const canEmbed = document.document_indexed;
  const canSuggest = document.text_extracted;
  const actionError =
    reprocessEmbeddings.error?.message || reprocessSuggestions.error?.message || null;

  return (
    <div className="space-y-5">
      <section>
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Retrieval readiness
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <RetrievalReadinessBadge document={document} />
          {!canAskDocument(document) && (
            <span className="text-[11px] text-text-muted">Ask unavailable until indexed</span>
          )}
        </div>
        <p className="mt-2 text-[13px] text-text-secondary">{readiness.description}</p>
      </section>

      <ProcessingStatus document={document} />
      <AISummary document={document} />

      <section>
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Reprocess
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !canEmbed}
            title={canEmbed ? undefined : "Index the document before re-embedding"}
            onClick={() => void reprocessEmbeddings.mutateAsync(document.id)}
          >
            <Sparkles className={`h-3.5 w-3.5 ${reprocessEmbeddings.isPending ? "animate-spin" : ""}`} />
            Re-embed
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !canSuggest}
            title={canSuggest ? undefined : "Extract text before requesting suggestions"}
            onClick={() => void reprocessSuggestions.mutateAsync(document.id)}
          >
            <Tags className={`h-3.5 w-3.5 ${reprocessSuggestions.isPending ? "animate-spin" : ""}`} />
            Suggest tags & folder
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-text-muted">
          Re-embed refreshes semantic search vectors. Suggestions create pending tag and folder
          proposals you can accept or reject.
        </p>
        {actionError && (
          <p role="alert" className="mt-2 text-[11px] text-danger">
            {actionError}
          </p>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Pending suggestions
        </h4>
        <InboxSuggestions documentId={document.id} showEmpty title="" />
      </section>

      <section>
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Ingestion history
        </h4>
        {recentJobs.length === 0 ? (
          <p className="text-xs text-text-muted">No recent jobs for this document.</p>
        ) : (
          <ul className="space-y-2">
            {recentJobs.map((job) => (
              <li
                key={job.id}
                className="rounded-md border border-surface-border px-2.5 py-2 text-[12px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text-primary">{job.job_type}</span>
                  <span className="text-text-muted">{job.status}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  {formatDateTime(job.created_at)}
                  {job.completed_at ? ` → ${formatDateTime(job.completed_at)}` : ""}
                </p>
                {job.status === "failed" && job.error && (
                  <p className="mt-1 text-[11px] text-danger">{job.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetadataFields({ document }: { document: Document }) {
  const updateMeta = useUpdateDocumentMetadata();

  const saveField = (data: Parameters<typeof updateMeta.mutate>[0]["data"]) => {
    updateMeta.mutate({ id: document.id, data });
  };

  return (
    <div className="space-y-5">
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
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
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
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
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
    </div>
  );
}

function OcrTab({ document }: { document: Document }) {
  const { data, isLoading, isError } = useDocumentContent(document.id);
  const retryOcr = useRetryOcr();
  const retryPreflight = useRetryPreflight();
  const [query, setQuery] = useState("");

  const pages = data?.pages ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => p.text.toLowerCase().includes(q));
  }, [pages, query]);

  const busy = retryOcr.isPending || retryPreflight.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {document.inbox ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void retryPreflight.mutateAsync(document.id)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            Retry preflight
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void retryOcr.mutateAsync(document.id)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            Retry OCR
          </Button>
        )}
        <p className="text-[11px] text-text-muted">
          {document.inbox
            ? "Re-runs extraction/OCR for Inbox documents."
            : "Clears chunks and embeddings, then re-OCRs and re-indexes."}
        </p>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter page text…"
        className="h-8"
        aria-label="Filter OCR text"
      />

      {isLoading && <p className="text-xs text-text-muted">Loading page text…</p>}
      {isError && <p className="text-xs text-danger">Failed to load page text.</p>}
      {!isLoading && !isError && pages.length === 0 && (
        <p className="text-xs text-text-muted">No extracted page text yet.</p>
      )}

      <div className="space-y-3">
        {filtered.map((page) => (
          <section
            key={page.page_number}
            className="rounded-md border border-surface-border bg-surface-muted/40 p-3"
          >
            <h5 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
              Page {page.page_number}
            </h5>
            <pre className="whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-text-primary">
              {page.text.trim() || "—"}
            </pre>
          </section>
        ))}
      </div>
    </div>
  );
}

/** @deprecated Prefer DocumentInspector; kept for Trash and simple embeds. */
export function MetadataPanel({ document }: { document: Document | undefined }) {
  return <DocumentInspector document={document} defaultTab="metadata" />;
}
