import { useState } from "react";
import { Search, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn, formatDate } from "@/lib/utils";
import { useSearchMutation, useFolders } from "@/lib/api/hooks";
import type { SearchMode, SearchHit } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { TagList } from "@/components/tags/TagList";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";

export function SearchWorkspace() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [folderId, setFolderId] = useState<string>("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [semanticAvailable, setSemanticAvailable] = useState(true);
  const [searched, setSearched] = useState(false);

  const searchMutation = useSearchMutation();
  const { data: folders = [] } = useFolders();

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    try {
      const res = await searchMutation.mutateAsync({
        query: query.trim(),
        mode,
        folder_id: folderId || undefined,
        include_descendants: true,
        page_size: 50,
      });
      setResults(res.items);
      setTotal(res.total);
      setSemanticAvailable(res.semantic_available);
      setSearched(true);
    } catch {
      setResults([]);
      setTotal(0);
      setSearched(true);
    }
  };

  const openDocument = (hit: SearchHit) => {
    const params = new URLSearchParams();
    params.set("doc", hit.document.id);
    if (hit.page_number) params.set("viewerPage", String(hit.page_number));
    navigate(`/documents?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-surface-border bg-surface px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary mb-4">Search</h1>
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[280px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="pl-10 h-10"
                autoFocus
              />
            </div>
          </div>
          <Select value={folderId || "all"} onValueChange={(v) => setFolderId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px] h-10">
              <SelectValue placeholder="All folders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All folders</SelectItem>
              {folders
                .filter((f) => f.kind === "normal")
                .map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.path_cache}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={!query.trim() || searchMutation.isPending}>
            Search
          </Button>
        </form>

        <div className="mt-3 flex items-center gap-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
            <TabsList>
              <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
              <TabsTrigger value="keyword">Keyword</TabsTrigger>
              <TabsTrigger value="semantic" disabled={!semanticAvailable}>
                Semantic
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {!semanticAvailable && (
            <span className="text-xs text-text-muted">
              Semantic search unavailable — configure an embedding provider
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {searchMutation.isPending && (
          <p className="text-text-muted text-sm">Searching…</p>
        )}
        {searched && !searchMutation.isPending && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-10 w-10 text-text-muted/40 mb-3" />
            <p className="text-sm text-text-secondary">No results found</p>
            <p className="text-xs text-text-muted mt-1">Try different keywords or filters</p>
          </div>
        )}
        {results.length > 0 && (
          <div>
            <p className="text-xs text-text-muted mb-4">{total} result{total !== 1 ? "s" : ""}</p>
            <ul className="space-y-2">
              {results.map((hit, i) => (
                <li key={`${hit.document.id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => openDocument(hit)}
                    className={cn(
                      "w-full rounded-md border border-surface-border bg-surface p-4 text-left",
                      "hover:border-accent/30 hover:bg-surface-hover transition-colors",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-text-muted mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary truncate">
                            {hit.document.title}
                          </span>
                          {hit.page_number && (
                            <span className="shrink-0 text-xs text-accent">
                              p.{hit.page_number}
                            </span>
                          )}
                          <span className="ml-auto shrink-0 text-xs text-text-muted">
                            {formatDate(hit.document.added_date)}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5 truncate">
                          {hit.document.folder_path}
                        </p>
                        {hit.snippet && (
                          <p
                            className="text-[13px] text-text-secondary mt-2 line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: hit.snippet }}
                          />
                        )}
                        <TagList tags={hit.document.tags} max={3} className="mt-2" />
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
