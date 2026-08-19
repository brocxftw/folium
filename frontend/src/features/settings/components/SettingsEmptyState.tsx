import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsEmptyState({
  children,
  className,
  bordered,
}: {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <p
      className={cn(
        "text-sm text-text-muted",
        bordered && "rounded-lg border border-dashed border-surface-border bg-surface p-10 text-center",
        className,
      )}
    >
      {children}
    </p>
  );
}
