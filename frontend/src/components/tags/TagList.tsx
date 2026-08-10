import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tag, TagBrief } from "@/lib/api/types";
import { useDeleteTag, useUpdateTag } from "@/lib/api/hooks";
import { TagBadge } from "./TagBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/** Preset swatches for tag color editing (slate, blue, teal, green, amber, rose, stone). */
export const TAG_COLOR_PRESETS = [
  "#64748b",
  "#2563eb",
  "#0d9488",
  "#16a34a",
  "#d97706",
  "#e11d48",
  "#78716c",
  "#1e3a5f",
] as const;

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

type TagDialog =
  | { type: "rename"; tag: Tag }
  | { type: "color"; tag: Tag }
  | { type: "delete"; tag: Tag }
  | null;

export function SidebarTagList({
  tags,
  selectedTagId,
  selectedTagIds,
  onSelect,
  variant = "sidebar",
}: SidebarTagListProps) {
  const surface = variant === "surface";
  const selected = new Set(selectedTagIds ?? (selectedTagId ? [selectedTagId] : []));
  const [dialog, setDialog] = useState<TagDialog>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_COLOR_PRESETS[0]);

  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const openRename = (tag: Tag) => {
    setName(tag.name);
    setDialog({ type: "rename", tag });
  };

  const openColor = (tag: Tag) => {
    setColor(tag.color || TAG_COLOR_PRESETS[0]);
    setDialog({ type: "color", tag });
  };

  const openDelete = (tag: Tag) => {
    setDialog({ type: "delete", tag });
  };

  const handleSubmit = async () => {
    if (!dialog) return;
    if (dialog.type === "delete") {
      await deleteTag.mutateAsync(dialog.tag.id);
      setDialog(null);
      return;
    }
    if (dialog.type === "rename") {
      if (!name.trim()) return;
      await updateTag.mutateAsync({ id: dialog.tag.id, data: { name: name.trim() } });
      setDialog(null);
      return;
    }
    if (dialog.type === "color") {
      await updateTag.mutateAsync({ id: dialog.tag.id, data: { color } });
      setDialog(null);
    }
  };

  const busy = updateTag.isPending || deleteTag.isPending;

  if (tags.length === 0) {
    return (
      <p className={cn("px-3 py-2 text-xs", surface ? "text-text-muted" : "text-sidebar-muted")}>
        No tags yet
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-0.5 px-2">
        {tags.map((tag) => {
          const isSelected = selected.has(tag.id);
          return (
            <li key={tag.id}>
              <div
                className={cn(
                  "group flex items-center rounded-md",
                  isSelected && (surface ? "bg-surface-muted" : "bg-sidebar-active"),
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect?.(tag.id)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-between px-2 py-1.5 text-left text-[13px]",
                    surface
                      ? "text-text-primary hover:bg-surface-hover"
                      : "text-sidebar-text hover:bg-sidebar-hover",
                    isSelected && (surface ? "bg-transparent" : "bg-transparent"),
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "mr-1 hidden h-6 w-6 shrink-0 items-center justify-center rounded group-hover:flex data-[state=open]:flex",
                        surface
                          ? "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text",
                      )}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Manage tag ${tag.name}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => openRename(tag)}>Rename</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openColor(tag)}>Change color</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-danger" onClick={() => openDelete(tag)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === "rename" && "Rename tag"}
              {dialog?.type === "color" && "Change tag color"}
              {dialog?.type === "delete" && "Delete tag"}
            </DialogTitle>
          </DialogHeader>
          {dialog?.type === "delete" ? (
            <p className="text-sm text-text-secondary">
              Delete &ldquo;{dialog.tag.name}&rdquo;? Documents keep their other tags; this tag is
              removed everywhere.
            </p>
          ) : dialog?.type === "rename" ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tag name"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
            />
          ) : dialog?.type === "color" ? (
            <div className="flex flex-wrap gap-2">
              {TAG_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  title={preset}
                  aria-label={`Color ${preset}`}
                  aria-pressed={color === preset}
                  onClick={() => setColor(preset)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-shadow",
                    color === preset
                      ? "border-text-primary ring-2 ring-accent/40"
                      : "border-transparent hover:ring-2 hover:ring-surface-border",
                  )}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={dialog?.type === "delete" ? "danger" : "default"}
              onClick={() => void handleSubmit()}
              disabled={busy || (dialog?.type === "rename" && !name.trim())}
            >
              {dialog?.type === "delete" ? "Delete" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
