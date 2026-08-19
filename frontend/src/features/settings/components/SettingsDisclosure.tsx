import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsDisclosure({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details className={cn("rounded-lg border border-surface-border bg-surface", className)} open={defaultOpen || undefined}>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text-primary marker:content-none [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="border-t border-surface-border px-4 py-4">{children}</div>
    </details>
  );
}
