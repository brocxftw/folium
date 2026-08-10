import { useMemo, useState } from "react";
import { Filter, RefreshCw, Search } from "lucide-react";
import type { Document } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { InboxActivityTable } from "./InboxActivityTable";
import {
  filterByActivityTab,
  matchesPresentationFilter,
  matchesSearch,
  type ActivityTab,
  type PresentationStatus,
} from "./inboxPresentation";

const TABS: { id: ActivityTab; label: string }[] = [
  { id: "recent", label: "Recent activity" },
  { id: "processed", label: "Processed" },
  { id: "failed", label: "Failed" },
];

const FILTER_OPTIONS: { id: PresentationStatus | "all"; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "queued", label: "Queued" },
  { id: "processing", label: "Processing" },
  { id: "processed", label: "Processed" },
  { id: "needs_review", label: "Needs review" },
  { id: "failed", label: "Failed" },
];

const PAGE_SIZE = 10;

interface InboxActivityPanelProps {
  documents: Document[];
  isLoading: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  onPreview: (id: string) => void;
  onOpenWork: () => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onUpload: () => void;
}

export function InboxActivityPanel({
  documents,
  isLoading,
  isFetching,
  onRefresh,
  onPreview,
  onOpenWork,
  onRetry,
  onRemove,
  onUpload,
}: InboxActivityPanelProps) {
  const [tab, setTab] = useState<ActivityTab>("recent");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PresentationStatus | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return filterByActivityTab(documents, tab)
      .filter((d) => matchesSearch(d, search))
      .filter((d) => matchesPresentationFilter(d, statusFilter));
  }, [documents, tab, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const emptyCopy = (() => {
    if (tab === "failed") {
      return {
        title: "No failed documents",
        body: "Everything in this range was processed successfully.",
      };
    }
    if (tab === "processed") {
      return {
        title: "No processed documents",
        body: "Processed documents will appear here once ingestion completes.",
      };
    }
    return {
      title: "No ingestion activity yet",
      body: "Upload documents to start building your ingestion history.",
    };
  })();

  return (
    <section className="mt-4 overflow-hidden rounded-[10px] border border-[#DCE3E8] bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#E7ECEF] px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className={cn(
                "border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors",
                tab === t.id
                  ? "border-[#07998E] text-[#07998E]"
                  : "border-transparent text-[#5D6B76] hover:text-[#14212B]",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[280px] max-w-full">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#74828D]" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search documents..."
              className="h-[30px] pl-8 text-xs"
            />
          </div>

          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "h-[30px]",
                  statusFilter !== "all" && "border-[#13B8AA] text-[#087F78]",
                )}
              >
                <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
                Filter
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={cn(
                    "block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-surface-hover",
                    statusFilter === opt.id && "bg-surface-muted font-medium",
                  )}
                  onClick={() => {
                    setStatusFilter(opt.id);
                    setPage(1);
                    setFilterOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Button
            size="icon"
            variant="outline"
            className="h-[30px] w-[30px]"
            aria-label="Refresh"
            title="Refresh"
            disabled={isFetching}
            onClick={onRefresh}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
              strokeWidth={1.75}
            />
          </Button>
        </div>
      </div>

      <InboxActivityTable
        documents={pageItems}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onPreview={onPreview}
        onOpenWork={onOpenWork}
        onRetry={onRetry}
        onRemove={onRemove}
        isLoading={isLoading}
        empty={
          <div className="max-w-sm py-6 text-center">
            <p className="text-sm font-medium text-[#14212B]">{emptyCopy.title}</p>
            <p className="mt-1 text-xs text-[#42515D]">{emptyCopy.body}</p>
            {tab === "recent" && (
              <Button size="sm" className="mt-4" onClick={onUpload}>
                Upload documents
              </Button>
            )}
          </div>
        }
      />

      <div className="flex items-center justify-between border-t border-[#E7ECEF] px-4 py-2.5 text-xs text-[#74828D]">
        <span>
          {filtered.length === 0
            ? "Showing 0 documents"
            : `Showing ${(safePage - 1) * PAGE_SIZE + 1} to ${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} documents`}
        </span>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, safePage - 3), Math.max(0, safePage - 3) + 5)
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex h-[30px] min-w-[30px] items-center justify-center rounded px-2 text-xs font-medium",
                    p === safePage
                      ? "bg-[#13B8AA] text-white"
                      : "text-[#5D6B76] hover:bg-surface-hover",
                  )}
                >
                  {p}
                </button>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
