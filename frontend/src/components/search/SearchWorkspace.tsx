import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFolders, useSearch, useTags } from "@/lib/api/hooks";
import type { SearchMode, SearchRequest } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { EvidenceSearchResults } from "./EvidenceSearchResults";

export function SearchWorkspace() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get("q") ?? "");
  const mode = (params.get("mode") as SearchMode) || "hybrid";
  const folderId = params.get("folder") ?? "";
  const tagId = params.get("tag") ?? "";
  const readiness = params.get("ready") ?? "any";

  const { data: folders = [] } = useFolders();
  const { data: tags = [] } = useTags();

  useEffect(() => {
    setDraft(params.get("q") ?? "");
  }, [params]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      const trimmed = draft.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      if (next.toString() !== params.toString()) {
        setParams(next, { replace: true });
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [draft, params, setParams]);

  const request: SearchRequest = useMemo(
    () => ({
      query: (params.get("q") ?? "").trim(),
      mode,
      folder_id: folderId || undefined,
      include_descendants: true,
      tag_ids: tagId ? [tagId] : undefined,
      document_indexed: readiness === "indexed" ? true : undefined,
      has_embeddings: readiness === "semantic" ? true : undefined,
      unprocessed: readiness === "unprocessed" ? true : undefined,
      page_size: 50,
    }),
    [params, mode, folderId, tagId, readiness],
  );

  const enabled = !!request.query;
  const { data, isLoading, isFetching } = useSearch(request, enabled);

  const patchParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all" || value === "any") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-surface-border bg-surface px-6 py-4">
        <h1 className="mb-4 text-lg font-semibold text-text-primary">Search</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = new URLSearchParams(params);
            const trimmed = draft.trim();
            if (trimmed) next.set("q", trimmed);
            else next.delete("q");
            setParams(next);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[280px] flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search documents…"
                className="h-10 pl-10"
                autoFocus
              />
            </div>
          </div>
          <Select
            value={folderId || "all"}
            onValueChange={(v) => patchParam("folder", v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-10 w-[180px]">
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
          <Select
            value={tagId || "all"}
            onValueChange={(v) => patchParam("tag", v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-10 w-[160px]">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={readiness} onValueChange={(v) => patchParam("ready", v)}>
            <SelectTrigger className="h-10 w-[170px]">
              <SelectValue placeholder="Readiness" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any readiness</SelectItem>
              <SelectItem value="indexed">Keyword ready</SelectItem>
              <SelectItem value="semantic">Semantic ready</SelectItem>
              <SelectItem value="unprocessed">Unprocessed</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={!draft.trim() || isFetching}>
            Search
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Tabs value={mode} onValueChange={(v) => patchParam("mode", v)}>
            <TabsList>
              <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
              <TabsTrigger value="keyword">Keyword</TabsTrigger>
              <TabsTrigger
                value="semantic"
                disabled={data ? !data.semantic_available : false}
              >
                Semantic
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {data && !data.semantic_available && (
            <span className="text-xs text-text-muted">
              Semantic search unavailable — configure an embedding provider
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!enabled && (
          <p className="text-sm text-text-muted">Enter a query to search your library.</p>
        )}
        {enabled && (
          <EvidenceSearchResults
            response={data}
            isLoading={isLoading}
            onOpen={(id, page) => {
              const next = new URLSearchParams();
              next.set("doc", id);
              if (page) next.set("viewerPage", String(page));
              navigate(`/documents?${next.toString()}`);
            }}
            askHref={
              request.query
                ? `/ask?q=${encodeURIComponent(request.query)}`
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
