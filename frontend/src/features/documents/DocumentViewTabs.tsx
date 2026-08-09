import { cn } from "@/lib/utils";
import type { LibraryView } from "./useDocumentsLibraryState";

const VIEWS: { id: LibraryView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "recent", label: "Recently added" },
  { id: "unprocessed", label: "Unprocessed" },
];

interface DocumentViewTabsProps {
  view: LibraryView;
  onChange: (view: LibraryView) => void;
  className?: string;
}

export function DocumentViewTabs({ view, onChange, className }: DocumentViewTabsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)} role="tablist">
      {VIEWS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={view === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            view === tab.id
              ? "bg-surface-muted font-medium text-text-primary"
              : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
