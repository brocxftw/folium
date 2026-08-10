import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Folder } from "@/lib/api/types";

export interface BreadcrumbCrumb {
  id: string | undefined;
  label: string;
}

/** Build ancestry crumbs by walking parent_id (root → current). */
export function buildFolderBreadcrumbs(
  folderId: string | undefined,
  folders: Folder[],
): BreadcrumbCrumb[] {
  const root: BreadcrumbCrumb = { id: undefined, label: "Documents" };
  if (!folderId) return [root];

  const byId = new Map(folders.map((f) => [f.id, f]));
  const folder = byId.get(folderId);
  if (!folder) return [root];

  const chain: Folder[] = [];
  let current: Folder | undefined = folder;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.kind !== "root") {
      chain.push(current);
    }
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  chain.reverse();

  return [root, ...chain.map((f) => ({ id: f.id, label: f.name }))];
}

interface BreadcrumbsProps {
  folderId?: string;
  folders: Folder[];
  className?: string;
  onNavigate?: (folderId: string | undefined) => void;
}

export function Breadcrumbs({
  folderId,
  folders,
  className,
  onNavigate,
}: BreadcrumbsProps) {
  const crumbs = buildFolderBreadcrumbs(folderId, folders);
  const lastIndex = crumbs.length - 1;

  return (
    <nav
      className={cn("flex flex-wrap items-center gap-1 text-[13px] text-text-secondary", className)}
      aria-label="Folder path"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === lastIndex;
        return (
          <span key={`${crumb.id ?? "root"}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-text-muted" />}
            {isLast || !onNavigate ? (
              <span
                className={cn(
                  isLast ? "font-medium text-text-primary" : undefined,
                  !isLast && "text-text-secondary",
                )}
              >
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(crumb.id)}
                className="truncate hover:text-text-primary"
              >
                {crumb.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
