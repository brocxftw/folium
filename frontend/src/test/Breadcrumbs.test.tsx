import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Breadcrumbs } from "@/components/documents/Breadcrumbs";
import type { Folder } from "@/lib/api/types";

const folders: Folder[] = [
  {
    id: "f1",
    name: "Finance",
    parent_id: "root",
    kind: "normal",
    sort_order: 0,
    path_cache: "Documents / Finance / Property / LPPSA",
    created_at: "",
    updated_at: "",
    children_count: 0,
    document_count: 8,
  },
];

describe("Breadcrumbs", () => {
  it("renders folder path segments", () => {
    render(<Breadcrumbs folderId="f1" folders={folders} />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("LPPSA")).toBeInTheDocument();
  });

  it("shows default when no folder selected", () => {
    render(<Breadcrumbs folders={folders} />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
  });
});
