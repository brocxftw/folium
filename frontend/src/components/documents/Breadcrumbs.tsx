import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Folder } from "@/lib/api/types";

interface BreadcrumbsProps {
  folderId?: string;
  folders: Folder[];
  className?: string;
}

export function Breadcrumbs({ folderId, folders, className }: BreadcrumbsProps) {
  if (!folderId) {
    return (
      <nav className={cn("flex items-center gap-1 text-[13px] text-text-secondary", className)}>
        <span className="text-text-primary">Documents</span>
      </nav>
    );
  }

  const folder = folders.find((f) => f.id === folderId);
  if (!folder) {
    return (
      <nav className={cn("flex items-center gap-1 text-[13px] text-text-secondary", className)}>
        <span className="text-text-primary">Documents</span>
      </nav>
    );
  }

  const parts = folder.path_cache.split(" / ").filter(Boolean);

  return (
    <nav className={cn("flex items-center gap-1 text-[13px] text-text-secondary", className)}>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-text-muted" />}
          <span
            className={cn(
              i === parts.length - 1 ? "text-text-primary font-medium" : "hover:text-text-primary",
            )}
          >
            {part}
          </span>
        </span>
      ))}
    </nav>
  );
}
