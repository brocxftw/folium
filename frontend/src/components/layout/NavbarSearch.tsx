import { type FormEvent, useEffect, useRef, useState } from "react";
import { FileText, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api/client";
import { useSearch } from "@/lib/api/hooks";
import type { SearchHit } from "@/lib/api/types";
import { sanitizeSearchSnippet } from "@/components/search/sanitizeSnippet";

const DEBOUNCE_MS = 300;

function documentHref(id: string, page?: number | null): string {
  const params = new URLSearchParams();
  params.set("doc", id);
  if (page && page > 1) params.set("viewerPage", String(page));
  return `/documents?${params.toString()}`;
}

export function NavbarSearch() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(draft.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draft]);

  const enabled = debounced.length > 0;
  const { data, isLoading } = useSearch(
    { query: debounced, mode: "keyword", page_size: 20 },
    enabled,
  );

  const showPanel = open && draft.trim().length > 0;
  const hits = data?.items ?? [];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
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
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const openHit = (hit: SearchHit) => {
    setOpen(false);
    navigate(documentHref(hit.document.id, hit.page_number));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hits[0]) openHit(hits[0]);
  };

  return (
    <form
      ref={rootRef}
      role="search"
      onSubmit={handleSubmit}
      className="relative w-[clamp(252px,25.2vw,306px)] shrink-0 lg:w-[clamp(288px,25.2vw,450px)]"
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[#CBD5E1]"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search documents, tags, folders..."
        aria-label="Search documents, tags, folders"
        aria-expanded={showPanel}
        aria-controls="navbar-search-results"
        className="h-[52px] w-full rounded-[10px] border border-[rgba(148,163,184,0.22)] bg-[rgba(30,41,59,0.72)] py-0 pr-4 pl-12 text-sm font-normal text-[#F8FAFC] shadow-[inset_0_1px_1px_rgba(255,255,255,0.025),0_2px_8px_rgba(2,6,23,0.10)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[#94A3B8] outline-none focus-visible:border-[rgba(45,212,191,0.65)] focus-visible:shadow-[0_0_0_3px_rgba(20,184,166,0.10)] focus-visible:outline-none"
      />
      {showPanel && (
        <div
          id="navbar-search-results"
          role="listbox"
          className="absolute top-[calc(100%+8px)] right-0 z-[60] max-h-[min(60vh,480px)] w-full min-w-[320px] overflow-auto rounded-[12px] border border-surface-border bg-surface text-text-primary shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
        >
          {enabled && isLoading && hits.length === 0 ? (
            <p className="px-3 py-4 text-sm text-text-muted">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-4 text-sm text-text-muted">No matching documents</p>
          ) : (
            <ul>
              {hits.map((hit) => (
                <li key={hit.document.id}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-hover"
                    onClick={() => openHit(hit)}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-muted">
                      {hit.document.has_thumbnail ? (
                        <img
                          src={api.thumbnailUrl(hit.document.id)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileText className="h-5 w-5 text-text-muted/50" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {hit.document.title || hit.document.original_filename}
                      </span>
                      {hit.snippet ? (
                        <span
                          className="mt-0.5 line-clamp-2 text-xs text-text-secondary"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeSearchSnippet(hit.snippet),
                          }}
                        />
                      ) : hit.document.folder_path ? (
                        <span className="mt-0.5 block truncate text-xs text-text-muted">
                          {hit.document.folder_path}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
