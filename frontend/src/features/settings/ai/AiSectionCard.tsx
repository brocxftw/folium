import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AiSectionCard({
  title,
  description,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-lg border border-surface-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6",
        className,
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr] lg:gap-10">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {description && (
            <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
          )}
        </div>
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </section>
  );
}
