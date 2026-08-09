import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { libraryStateToSearchParams } from "./useDocumentsLibraryState";

/** Redirect legacy `/documents/...` path routes to `/documents?...` query state. */
export function LegacyDocumentsRedirect() {
  const { folderId, documentId } = useParams<{
    folderId?: string;
    documentId?: string;
  }>();
  const [searchParams] = useSearchParams();

  const pageRaw = searchParams.get("viewerPage") ?? searchParams.get("page");
  const viewerPage = pageRaw ? Number.parseInt(pageRaw, 10) : undefined;

  const next = libraryStateToSearchParams({
    view: "all",
    q: "",
    searchMode: "hybrid",
    tagIds: [],
    sort: "added_date",
    order: "desc",
    page: 1,
    pageSize: 50,
    folderId: folderId || undefined,
    docId: documentId || undefined,
    viewerPage:
      viewerPage && Number.isFinite(viewerPage) && viewerPage > 1
        ? viewerPage
        : undefined,
  });

  // Preserve unrelated query params (e.g. future flags) except ones we remap.
  const preserved = new URLSearchParams(searchParams);
  for (const key of ["page", "viewerPage", "vp", "doc", "folder", "view"]) {
    preserved.delete(key);
  }
  for (const [k, v] of next.entries()) {
    preserved.set(k, v);
  }

  return (
    <Navigate
      to={{ pathname: "/documents", search: preserved.toString() }}
      replace
    />
  );
}
