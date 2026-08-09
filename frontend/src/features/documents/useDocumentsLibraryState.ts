import { useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { DocumentListParams, SearchMode, SearchRequest } from "@/lib/api/types";

export type LibraryView = "all" | "recent" | "unprocessed";
export type LibrarySort = "added_date" | "title" | "modified_date" | "created_date";
export type LibraryOrder = "asc" | "desc";

export interface DocumentsLibraryState {
  view: LibraryView;
  folderId?: string;
  q: string;
  searchMode: SearchMode;
  tagIds: string[];
  sort: LibrarySort;
  order: LibraryOrder;
  page: number;
  pageSize: number;
  docId?: string;
  viewerPage?: number;
}

const DEFAULTS: DocumentsLibraryState = {
  view: "all",
  q: "",
  searchMode: "hybrid",
  tagIds: [],
  sort: "added_date",
  order: "desc",
  page: 1,
  pageSize: 50,
};

function parseView(raw: string | null): LibraryView {
  if (raw === "recent" || raw === "unprocessed") return raw;
  return "all";
}

function parseSort(raw: string | null): LibrarySort {
  if (
    raw === "title" ||
    raw === "modified_date" ||
    raw === "created_date" ||
    raw === "added_date"
  ) {
    return raw;
  }
  return "added_date";
}

function parseOrder(raw: string | null): LibraryOrder {
  return raw === "asc" ? "asc" : "desc";
}

function parseSearchMode(raw: string | null): SearchMode {
  if (raw === "keyword" || raw === "semantic" || raw === "hybrid") return raw;
  return "hybrid";
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseLibraryState(params: URLSearchParams): DocumentsLibraryState {
  const tags = params.getAll("tag").filter(Boolean);
  const tagCsv = params.get("tags");
  if (tagCsv) {
    for (const part of tagCsv.split(",")) {
      const t = part.trim();
      if (t && !tags.includes(t)) tags.push(t);
    }
  }

  const viewerPageRaw = params.get("viewerPage") ?? params.get("vp");
  const legacyViewerPage =
    !viewerPageRaw && params.has("doc") && params.has("page") && !params.get("page")?.includes("-")
      ? params.get("page")
      : null;

  return {
    view: parseView(params.get("view")),
    folderId: params.get("folder") || undefined,
    q: params.get("q") ?? "",
    searchMode: parseSearchMode(params.get("smode") ?? params.get("mode")),
    tagIds: tags,
    sort: parseSort(params.get("sort")),
    order: parseOrder(params.get("order")),
    page: parsePositiveInt(params.get("page"), 1),
    pageSize: parsePositiveInt(params.get("pageSize"), 50),
    docId: params.get("doc") || undefined,
    viewerPage: viewerPageRaw
      ? parsePositiveInt(viewerPageRaw, 1)
      : legacyViewerPage
        ? parsePositiveInt(legacyViewerPage, 1)
        : undefined,
  };
}

export function libraryStateToSearchParams(
  state: DocumentsLibraryState,
  base?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(base);
  const keysToClear = [
    "view",
    "folder",
    "q",
    "smode",
    "mode",
    "tag",
    "tags",
    "sort",
    "order",
    "page",
    "pageSize",
    "doc",
    "viewerPage",
    "vp",
  ];
  for (const key of keysToClear) next.delete(key);

  if (state.view !== "all") next.set("view", state.view);
  if (state.folderId) next.set("folder", state.folderId);
  if (state.q.trim()) next.set("q", state.q.trim());
  if (state.searchMode !== "hybrid") next.set("smode", state.searchMode);
  for (const tag of state.tagIds) next.append("tag", tag);
  if (state.sort !== "added_date") next.set("sort", state.sort);
  if (state.order !== "desc") next.set("order", state.order);
  if (state.page > 1) next.set("page", String(state.page));
  if (state.pageSize !== 50) next.set("pageSize", String(state.pageSize));
  if (state.docId) next.set("doc", state.docId);
  if (state.viewerPage && state.viewerPage > 1) {
    next.set("viewerPage", String(state.viewerPage));
  }
  return next;
}

export function libraryStateToListParams(state: DocumentsLibraryState): DocumentListParams {
  const isRecent = state.view === "recent";
  return {
    folder_id: state.folderId,
    include_descendants: !!state.folderId,
    tag_ids: state.tagIds.length ? state.tagIds : undefined,
    sort: isRecent ? "added_date" : state.sort,
    order: isRecent ? "desc" : state.order,
    page: state.page,
    page_size: state.pageSize,
    unprocessed: state.view === "unprocessed" ? true : undefined,
    inbox: state.view === "unprocessed" ? undefined : false,
  };
}

export function libraryStateToEvidenceSearchRequest(
  state: DocumentsLibraryState,
): SearchRequest {
  return {
    query: state.q.trim(),
    mode: state.searchMode,
    folder_id: state.folderId,
    include_descendants: !!state.folderId,
    tag_ids: state.tagIds.length ? state.tagIds : undefined,
    unprocessed: state.view === "unprocessed" ? true : undefined,
    inbox: state.view === "unprocessed" ? undefined : false,
    page: state.page,
    page_size: state.pageSize,
  };
}

export function useDocumentsLibraryState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const state = useMemo(() => parseLibraryState(searchParams), [searchParams]);
  const isEvidenceSearch = !!state.q.trim();

  const patch = useCallback(
    (partial: Partial<DocumentsLibraryState>, options?: { replace?: boolean }) => {
      const merged: DocumentsLibraryState = {
        ...state,
        ...partial,
      };
      if (
        partial.page === undefined &&
        (partial.view !== undefined ||
          partial.folderId !== undefined ||
          partial.q !== undefined ||
          partial.searchMode !== undefined ||
          partial.tagIds !== undefined ||
          partial.sort !== undefined ||
          partial.order !== undefined)
      ) {
        merged.page = 1;
      }
      const next = libraryStateToSearchParams(merged);
      setSearchParams(next, { replace: options?.replace ?? false });
    },
    [setSearchParams, state],
  );

  const openDocument = useCallback(
    (docId: string, viewerPage?: number) => {
      patch({
        docId,
        viewerPage: viewerPage && viewerPage > 1 ? viewerPage : undefined,
      });
    },
    [patch],
  );

  const closeDocument = useCallback(() => {
    patch({ docId: undefined, viewerPage: undefined }, { replace: true });
  }, [patch]);

  const setViewerPage = useCallback(
    (viewerPage: number) => {
      patch({ viewerPage: viewerPage > 1 ? viewerPage : undefined }, { replace: true });
    },
    [patch],
  );

  const replaceLegacy = useCallback(
    (partial: Partial<DocumentsLibraryState>) => {
      const next = libraryStateToSearchParams({ ...DEFAULTS, ...partial });
      navigate({ pathname: "/documents", search: next.toString() }, { replace: true });
    },
    [navigate],
  );

  return {
    state,
    patch,
    openDocument,
    closeDocument,
    setViewerPage,
    replaceLegacy,
    isEvidenceSearch,
    listParams: libraryStateToListParams(state),
    evidenceRequest: libraryStateToEvidenceSearchRequest(state),
  };
}
