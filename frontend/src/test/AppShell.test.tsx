import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi, afterEach } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import foliumMark from "@/assets/brand/folium-mark.png";
import type { SearchHit } from "@/lib/api/types";

const { searchHits } = vi.hoisted(() => ({ searchHits: [] as SearchHit[] }));

vi.mock("@/lib/api/hooks", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "user-1",
        username: "brocx",
        display_name: "brocx",
        is_admin: true,
        has_avatar: false,
      },
      csrf_token: "test",
    },
  }),
  useLogout: () => ({ mutateAsync: vi.fn() }),
  useInboxCount: () => ({ data: 0 }),
  useTrashCount: () => ({ data: { total: 0, documents: 0, folders: 0, retention_days: 30 } }),
  useHealth: () => ({ data: { status: "ok", version: "0.1.18" } }),
  useAIHealth: () => ({
    data: {
      ocr: { status: "available", provider: "tesseract", model: "eng", latency_ms: 1, last_checked: null, error: null },
      indexing: { status: "available", provider: "local", model: "gemma", latency_ms: 1, last_checked: null, error: null },
      embedding: { status: "available", provider: "local", model: "mxbai", latency_ms: 1, last_checked: null, error: null },
      chat: { status: "available", provider: "local", model: "qwen", latency_ms: 1, last_checked: null, error: null },
      auto_tagging: true,
      auto_enrichment: true,
    },
  }),
  useJobs: () => ({ data: [] }),
  useSearch: (_request: unknown, enabled = true) => ({
    data:
      enabled && searchHits.length > 0
        ? {
            items: searchHits,
            total: searchHits.length,
            mode: "keyword",
            semantic_available: true,
          }
        : undefined,
    isLoading: false,
    isFetching: false,
  }),
  useAsk: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAICapabilities: () => ({ data: undefined }),
  useFolders: () => ({ data: [] }),
}));

vi.mock("@/lib/api/upload", () => ({
  useDocumentUploader: () => ({
    busy: false,
    progress: null,
    lastSummary: null,
    clearSummary: vi.fn(),
    uploadFileList: vi.fn(),
    uploadEntries: vi.fn(),
    uploadDataTransfer: vi.fn(),
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderShell(initialEntry = "/documents") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="*"
          element={
            <AppShell>
              <LocationProbe />
            </AppShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppShell top navbar", () => {
  afterEach(() => {
    searchHits.splice(0, searchHits.length);
  });
  it("renders Inbox, Library, Trash, and Settings as primary navigation", () => {
    renderShell();
    const navigation = screen.getByRole("navigation", { name: "Primary" });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/inbox",
      "/documents",
      "/trash",
      "/settings",
    ]);
  });

  it("does not show Ask, Search, or Jobs as primary nav items", () => {
    renderShell();
    const navigation = screen.getByRole("navigation", { name: "Primary" });
    expect(within(navigation).queryByRole("link", { name: "Ask" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "Search" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "Jobs" })).not.toBeInTheDocument();
  });

  it("uses text-only primary navigation without menu icons", () => {
    renderShell();
    const navigation = screen.getByRole("navigation", { name: "Primary" });
    expect(navigation.querySelector("svg")).toBeNull();
  });

  it("shows the supplied brand mark, Folium, and a Beta label under the name", () => {
    renderShell();
    const header = screen.getByRole("banner");
    const mark = header.querySelector(`img[src="${foliumMark}"]`);
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveAttribute("width", "40");
    expect(mark).toHaveAttribute("height", "40");
    expect(screen.getByText("Folium")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByLabelText(/app version/i)).not.toBeInTheDocument();
  });

  it("places Settings in the primary nav rather than as an icon control", () => {
    renderShell();
    const navigation = screen.getByRole("navigation", { name: "Primary" });
    expect(within(navigation).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(screen.getAllByRole("link", { name: "Settings" })).toHaveLength(1);
  });

  it("places Upload immediately left of the AI status control", () => {
    renderShell();
    const upload = screen.getByRole("button", { name: "Upload" });
    const ai = screen.getByRole("button", { name: "Open AI settings" });
    expect(upload.compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a compact AI status control", () => {
    renderShell();
    expect(screen.getByRole("button", { name: "Open AI settings" })).toHaveTextContent("AI Ready");
  });

  it("omits the overall AI status and OCR rows from the AI hover card", async () => {
    renderShell();
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Open AI settings" }));
    fireEvent.focus(screen.getByRole("button", { name: "Open AI settings" }));
    expect(await screen.findByText("Indexing")).toBeInTheDocument();
    expect(screen.getByText("Embedding")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.queryByText("OCR")).not.toBeInTheDocument();
    expect(screen.queryByText("READY")).not.toBeInTheDocument();
  });

  it("keeps log out inside the account menu rather than as a standalone control", () => {
    renderShell();
    expect(screen.queryByRole("menuitem", { name: "Log out" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });

  it("does not navigate to /search when submitting the global search box", () => {
    renderShell();
    const input = screen.getByRole("searchbox", { name: "Search documents, tags, folders" });
    fireEvent.change(input, { target: { value: "contracts" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByTestId("location")).toHaveTextContent("/documents");
    expect(screen.getByTestId("location")).not.toHaveTextContent("/search");
  });

  it("hides the search overlay when the query is empty", () => {
    renderShell();
    fireEvent.focus(screen.getByRole("searchbox", { name: "Search documents, tags, folders" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("lists keyword search hits in an overlay and opens the document", async () => {
    searchHits.splice(0, searchHits.length, {
      document: {
        id: "doc-1",
        title: "Q3 contracts",
        original_filename: "contracts.pdf",
        has_thumbnail: false,
        folder_path: "/Legal",
      },
      score: 1,
      snippet: "indemnity clause",
      page_number: 2,
      chunk_id: null,
    } as SearchHit);

    renderShell();
    const input = screen.getByRole("searchbox", { name: "Search documents, tags, folders" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "contracts" } });

    expect(await screen.findByRole("option", { name: /Q3 contracts/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Q3 contracts/ }));
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/documents?doc=doc-1&viewerPage=2");
    });
  });

  it("exposes Ask Folium as a floating control", () => {
    renderShell();
    expect(screen.getByRole("button", { name: "Ask Folium AI" })).toBeInTheDocument();
  });
});
