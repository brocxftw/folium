import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  Breadcrumbs,
  buildFolderBreadcrumbs,
} from "@/components/documents/Breadcrumbs";
import type { Folder } from "@/lib/api/types";

function folder(
  partial: Pick<Folder, "id" | "name" | "parent_id" | "kind" | "path_cache">,
): Folder {
  return {
    sort_order: 0,
    created_at: "",
    updated_at: "",
    children_count: 0,
    document_count: 0,
    ...partial,
  };
}

const folders: Folder[] = [
  folder({
    id: "root",
    name: "Documents",
    parent_id: null,
    kind: "root",
    path_cache: "Documents",
  }),
  folder({
    id: "finance",
    name: "Finance",
    parent_id: "root",
    kind: "normal",
    path_cache: "Documents / Finance",
  }),
  folder({
    id: "property",
    name: "Property",
    parent_id: "finance",
    kind: "normal",
    path_cache: "Documents / Finance / Property",
  }),
  folder({
    id: "lppsa",
    name: "LPPSA",
    parent_id: "property",
    kind: "normal",
    path_cache: "Documents / Finance / Property / LPPSA",
  }),
];

describe("buildFolderBreadcrumbs", () => {
  it("walks parent_id ancestry and skips root folder node", () => {
    expect(buildFolderBreadcrumbs("lppsa", folders)).toEqual([
      { id: undefined, label: "Documents" },
      { id: "finance", label: "Finance" },
      { id: "property", label: "Property" },
      { id: "lppsa", label: "LPPSA" },
    ]);
  });

  it("returns Documents only when no folder selected", () => {
    expect(buildFolderBreadcrumbs(undefined, folders)).toEqual([
      { id: undefined, label: "Documents" },
    ]);
  });
});

describe("Breadcrumbs", () => {
  it("renders folder path segments", () => {
    render(<Breadcrumbs folderId="lppsa" folders={folders} />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Property")).toBeInTheDocument();
    expect(screen.getByText("LPPSA")).toBeInTheDocument();
  });

  it("shows default when no folder selected", () => {
    render(<Breadcrumbs folders={folders} />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
  });

  it("calls onNavigate for ancestor crumbs", () => {
    const onNavigate = vi.fn();
    render(
      <Breadcrumbs folderId="lppsa" folders={folders} onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Finance" }));
    expect(onNavigate).toHaveBeenCalledWith("finance");
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    expect(onNavigate).toHaveBeenCalledWith(undefined);
  });
});
