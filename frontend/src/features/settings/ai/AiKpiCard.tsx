import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiKpiCard({
  label,
  value,
  secondary,
  icon: Icon,
  iconColour = "#0D9488",
  className,
}: {
  label: string;
  value: string;
  secondary?: string;
  icon: LucideIcon;
  iconColour?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[88px] flex-col justify-between rounded-lg border border-surface-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center" style={{ color: iconColour }}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xl font-semibold leading-tight text-text-primary">{value}</p>
        {secondary && (
          <p className="mt-1 text-xs text-text-secondary">{secondary}</p>
        )}
      </div>
    </div>
  );
}
