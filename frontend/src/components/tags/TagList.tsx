import { cn } from "@/lib/utils";
import type { Tag, TagBrief } from "@/lib/api/types";
import { TagBadge } from "./TagBadge";

interface TagListProps {
  tags: TagBrief[];
  className?: string;
  max?: number;
  onRemove?: (tagId: string) => void;
}

export function TagList({ tags, className, max, onRemove }: TagListProps) {
  const visible = max ? tags.slice(0, max) : tags;
  const overflow = max && tags.length > max ? tags.length - max : 0;

  if (tags.length === 0) {
    return <span className="text-text-muted text-xs">—</span>;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visible.map((tag) => (
        <TagBadge
          key={tag.id}
          tag={tag}
          onRemove={onRemove ? () => onRemove(tag.id) : undefined}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[11px] text-text-muted self-center">+{overflow}</span>
      )}
    </div>
  );
}

interface SidebarTagListProps {
  tags: Tag[];
  selectedTagId?: string;
  selectedTagIds?: string[];
  onSelect?: (tagId: string) => void;
  variant?: "sidebar" | "surface";
}

export function SidebarTagList({
  tags,
  selectedTagId,
  selectedTagIds,
  onSelect,
  variant = "sidebar",
}: SidebarTagListProps) {
  const surface = variant === "surface";
  const selected = new Set(selectedTagIds ?? (selectedTagId ? [selectedTagId] : []));

  if (tags.length === 0) {
    return (
      <p className={cn("px-3 py-2 text-xs", surface ? "text-text-muted" : "text-sidebar-muted")}>
        No tags yet
      </p>
    );
  }

  return (
    <ul className="space-y-0.5 px-2">
      {tags.map((tag) => {
        const isSelected = selected.has(tag.id);
        return (
          <li key={tag.id}>
            <button
              type="button"
              onClick={() => onSelect?.(tag.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px]",
                surface
                  ? "text-text-primary hover:bg-surface-hover"
                  : "text-sidebar-text hover:bg-sidebar-hover",
                isSelected && (surface ? "bg-surface-muted" : "bg-sidebar-active"),
              )}
            >
              <span className="flex items-center gap-2 truncate">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="truncate">{tag.name}</span>
              </span>
              <span
                className={cn(
                  "ml-2 shrink-0 text-xs",
                  surface ? "text-text-muted" : "text-sidebar-muted",
                )}
              >
                {tag.document_count}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
