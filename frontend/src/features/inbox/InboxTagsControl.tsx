import { useMemo, useState } from "react";
import type { Document } from "@/lib/api/types";
import { useCreateTag, useTags, useUpdateDocumentMetadata } from "@/lib/api/hooks";
import { TagBadge } from "@/components/tags/TagBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";

interface InboxTagsControlProps {
  document: Document;
  stopPropagation?: boolean;
}

export function InboxTagsControl({ document: doc, stopPropagation }: InboxTagsControlProps) {
  const { data: allTags = [] } = useTags();
  const update = useUpdateDocumentMetadata();
  const createTag = useCreateTag();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedIds = useMemo(() => new Set(doc.tags.map((t) => t.id)), [doc.tags]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTags
      .filter((t) => !selectedIds.has(t.id))
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [allTags, selectedIds, query]);

  const setTags = async (tagIds: string[]) => {
    await update.mutateAsync({ id: doc.id, data: { tag_ids: tagIds } });
  };

  const addTag = async (tagId: string) => {
    await setTags([...selectedIds, tagId]);
  };

  const removeTag = async (tagId: string) => {
    await setTags([...selectedIds].filter((id) => id !== tagId));
  };

  const createAndAdd = async () => {
    const name = query.trim();
    if (!name) return;
    const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      await addTag(existing.id);
    } else {
      const created = await createTag.mutateAsync({ name });
      await setTags([...selectedIds, created.id]);
    }
    setQuery("");
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      onClick={(e) => stopPropagation && e.stopPropagation()}
    >
      {doc.tags.slice(0, 4).map((tag) => (
        <TagBadge key={tag.id} tag={tag} onRemove={() => void removeTag(tag.id)} />
      ))}
      {doc.tags.length > 4 && (
        <span className="text-[11px] text-text-muted">+{doc.tags.length - 4}</span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded border border-dashed border-surface-border px-1.5 py-0.5 text-[11px] text-text-muted hover:border-text-muted hover:text-text-primary"
          >
            +
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find or create tag…"
            className="h-7 text-xs mb-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") void createAndAdd();
            }}
          />
          <div className="max-h-36 overflow-y-auto">
            {available.map((t) => (
              <button
                key={t.id}
                type="button"
                className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-surface-hover"
                onClick={() => void addTag(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
          {query.trim() && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 h-7 w-full justify-start text-xs"
              onClick={() => void createAndAdd()}
            >
              Create “{query.trim()}”
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
