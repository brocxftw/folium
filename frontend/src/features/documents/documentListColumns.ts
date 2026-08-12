import { cn } from "@/lib/utils";

/**
 * Shared document-list geometry for header + every row.
 *
 * xl tracks:
 *   checkbox | name | tags | pages/size | status | date | actions
 *
 * DATE is a fixed 140px track with right padding so dates stay clearly
 * separated from the fixed ACTIONS column (gap + padding ≈ 28–32px).
 */
export const documentListRowClass = cn(
  "grid w-full items-center gap-x-4 px-2",
  // Mobile: checkbox | name | date | actions
  "grid-cols-[32px_minmax(0,1fr)_140px_52px]",
  // sm+: + status before date
  "sm:grid-cols-[32px_minmax(0,1.8fr)_minmax(9.5rem,0.85fr)_140px_52px]",
  // md+: + tags after name
  "md:grid-cols-[32px_minmax(0,2.2fr)_minmax(11rem,1fr)_minmax(9.5rem,0.85fr)_140px_52px]",
  // xl+: + pages/size after tags
  "xl:grid-cols-[32px_minmax(0,2.5fr)_minmax(11rem,1fr)_minmax(7.5rem,0.7fr)_minmax(9.5rem,0.85fr)_140px_52px]",
);

export const documentListCell = {
  checkbox: "flex w-full items-center justify-center",
  name: "min-w-0",
  tags: "hidden min-w-0 overflow-hidden md:block",
  pages:
    "hidden min-w-0 overflow-hidden whitespace-nowrap text-xs text-text-secondary xl:block",
  status: "hidden min-w-0 overflow-hidden sm:block",
  // Fixed track + right padding creates the DATE ↔ ACTIONS gutter.
  date: "w-full overflow-hidden whitespace-nowrap pr-4 text-right text-xs text-text-secondary",
  actions: "flex w-full items-center justify-center",
} as const;
