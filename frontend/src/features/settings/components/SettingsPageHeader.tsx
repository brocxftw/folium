import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-7 text-text-primary">{title}</h1>
        {description && (
          <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-text-secondary">{description}</p>
        )}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
