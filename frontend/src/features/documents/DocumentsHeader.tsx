import { useEffect, useRef, useState } from "react";
import { FolderUp, Search, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { SearchMode } from "@/lib/api/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { DocumentViewTabs } from "./DocumentViewTabs";
import type { LibraryView } from "./useDocumentsLibraryState";

interface DocumentsHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery: string;
  searchMode: SearchMode;
  evidenceActive?: boolean;
  semanticAvailable?: boolean;
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
  onSearchCommit: (q: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onAsk: () => void;
  onUploadFiles: () => void;
  onUploadFolder: () => void;
  uploadBusy?: boolean;
}

export function DocumentsHeader({
  title,
  subtitle,
  searchQuery,
  searchMode,
  evidenceActive,
  semanticAvailable = true,
  view,
  onViewChange,
  onSearchCommit,
  onSearchModeChange,
  onAsk,
  onUploadFiles,
  onUploadFolder,
  uploadBusy,
}: DocumentsHeaderProps) {
  const [draft, setDraft] = useState(searchQuery);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(searchQuery);
  }, [searchQuery]);

  // Debounce commit while typing for evidence search.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft !== searchQuery) onSearchCommit(draft);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [draft, searchQuery, onSearchCommit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="border-b border-surface-border bg-surface px-6 py-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-text-primary">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
          )}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <form
            className="relative w-[330px] shrink-0"
            onSubmit={(e) => {
              e.preventDefault();
              onSearchCommit(draft);
            }}
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              ref={searchRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search library…"
              className="h-10 rounded-xl border-[#CBD5E1] pl-10 pr-12"
              aria-label="Search library"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-surface-border bg-surface-muted px-2 py-1 text-[11px] font-medium text-text-secondary">
              /
            </kbd>
          </form>

          <Button size="sm" variant="secondary" className="h-10 px-3.5" onClick={onAsk}>
            <Sparkles className="h-3.5 w-3.5" />
            Ask Folium
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-10 px-3.5" disabled={uploadBusy}>
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onUploadFiles}>
                <Upload className="h-3.5 w-3.5" />
                Upload files…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onUploadFolder}>
                <FolderUp className="h-3.5 w-3.5" />
                Upload folder…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DocumentViewTabs view={view} onChange={onViewChange} />

      {(evidenceActive || draft.trim()) && (
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={searchMode}
            onValueChange={(v) => onSearchModeChange(v as SearchMode)}
          >
            <TabsList className="h-8">
              <TabsTrigger value="hybrid" className="h-6 px-2 text-xs">
                Hybrid
              </TabsTrigger>
              <TabsTrigger value="keyword" className="h-6 px-2 text-xs">
                Keyword
              </TabsTrigger>
              <TabsTrigger
                value="semantic"
                className="h-6 px-2 text-xs"
                disabled={!semanticAvailable}
              >
                Semantic
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {!semanticAvailable && (
            <span className="text-[11px] text-text-muted">
              Semantic unavailable — configure an embedding provider
            </span>
          )}
        </div>
      )}
    </div>
  );
}
