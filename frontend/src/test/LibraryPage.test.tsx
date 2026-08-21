import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LibraryPage } from "@/features/settings/LibraryPage";

vi.mock("@/lib/api/hooks", () => ({
  useLibraryOverview: () => ({
    data: {
      activity: {
        documents_ingested: 1,
        bytes_ingested: 1024,
        pages_processed: 2,
        successful_processing: 1,
        ocr_pages: 0,
        failed_documents: 0,
        duplicates_rejected: 0,
        purged_documents: 0,
        reset_at: "2026-01-01T00:00:00Z",
        since_label: "01 Jan 2026",
      },
      snapshot: {
        current_documents: 1,
        library_size_bytes: 1024,
        folders: 1,
        tags: 0,
        archived: 0,
        unprocessed: 0,
      },
      file_types: { items: [], total_types: 0, total_documents: 0, total_bytes: 0 },
      health: {
        needs_processing: 0,
        failed_documents: 0,
        missing_text: 0,
        unused_tags: 0,
        duplicate_content: 0,
        empty_folders: 0,
      },
      tags: [],
    },
    isLoading: false,
    error: null,
  }),
  useResetLibraryStatistics: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMergeTags: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("Library settings", () => {
  it("does not number section headings", () => {
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    );
    for (const heading of screen.getAllByRole("heading")) {
      expect(heading.textContent || "").not.toMatch(/^\d+\.\s/);
    }
    expect(screen.getByRole("heading", { name: "Library activity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset statistics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New tag" })).toBeInTheDocument();
  });
});
