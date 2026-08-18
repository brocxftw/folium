import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import foliumMark from "@/assets/brand/folium-mark.png";

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

  it("submits the global search box to the existing search route", () => {
    renderShell();
    const input = screen.getByRole("searchbox", { name: "Search documents, tags, folders" });
    fireEvent.change(input, { target: { value: "  contracts  " } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByTestId("location")).toHaveTextContent("/search?q=contracts");
  });

  it("seeds the global search box from the search page query", () => {
    renderShell("/search?q=invoices");
    expect(screen.getByRole("searchbox", { name: "Search documents, tags, folders" })).toHaveValue(
      "invoices",
    );
  });
});
