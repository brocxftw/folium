import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";

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

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/documents"]}>
      <AppShell>
        <p>Workspace</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell top navbar", () => {
  it("renders Inbox, Library, and Trash as primary navigation", () => {
    renderShell();
    const navigation = screen.getByRole("navigation", { name: "Primary" });
    const links = within(navigation).getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(within(navigation).getByRole("link", { name: "Inbox" })).toHaveAttribute("href", "/inbox");
    expect(within(navigation).getByRole("link", { name: "Library" })).toHaveAttribute(
      "href",
      "/documents",
    );
    expect(within(navigation).getByRole("link", { name: "Trash" })).toHaveAttribute("href", "/trash");
  });

  it("does not show Ask, Search, or Jobs as primary nav items", () => {
    renderShell();
    const navigation = screen.getByRole("navigation", { name: "Primary" });
    expect(within(navigation).queryByRole("link", { name: "Ask" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "Search" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "Jobs" })).not.toBeInTheDocument();
  });

  it("places Settings as an icon-only control outside the primary nav", () => {
    renderShell();
    const navigation = screen.getByRole("navigation", { name: "Primary" });
    expect(within(navigation).queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("shows a compact AI status control", () => {
    renderShell();
    expect(screen.getByRole("button", { name: "Open AI settings" })).toHaveTextContent("AI");
  });

  it("keeps log out inside the account menu rather than as a standalone control", () => {
    renderShell();
    expect(screen.queryByRole("menuitem", { name: "Log out" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });
});
