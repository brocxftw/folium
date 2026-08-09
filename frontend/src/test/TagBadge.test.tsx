import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TagBadge } from "@/components/tags/TagBadge";

describe("TagBadge", () => {
  it("renders tag name", () => {
    render(
      <TagBadge tag={{ id: "1", name: "Finance", color: "#64748b" }} />,
    );
    expect(screen.getByText("Finance")).toBeInTheDocument();
  });

  it("calls onRemove when remove button clicked", async () => {
    const onRemove = vi.fn();
    render(
      <TagBadge
        tag={{ id: "1", name: "Legal", color: "#6366f1" }}
        onRemove={onRemove}
      />,
    );
    await screen.getByLabelText("Remove Legal").click();
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
