import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentsHeader } from "@/features/documents/DocumentsHeader";

const noop = () => undefined;

function renderHeader() {
  return render(
    <DocumentsHeader
      title="Documents"
      subtitle="Find and organise your library"
      searchQuery=""
      searchMode="hybrid"
      view="all"
      onViewChange={noop}
      onSearchCommit={noop}
      onSearchModeChange={noop}
      onAsk={noop}
      onUploadFiles={noop}
      onUploadFolder={noop}
    />,
  );
}

describe("DocumentsHeader", () => {
  it("places search immediately left of Ask Folium and Upload", () => {
    renderHeader();
    const search = screen.getByLabelText("Search library");
    const ask = screen.getByRole("button", { name: "Ask Folium" });
    const upload = screen.getByRole("button", { name: "Upload" });
    expect(search.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ask.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders library view tabs in the header", () => {
    renderHeader();
    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Recently added" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Unprocessed" })).toBeInTheDocument();
  });

  it("shows a slash shortcut hint and focuses search on /", () => {
    renderHeader();
    expect(screen.getByText("/")).toBeInTheDocument();
    const search = screen.getByLabelText("Search library");
    fireEvent.keyDown(window, { key: "/" });
    expect(search).toHaveFocus();
  });
});
