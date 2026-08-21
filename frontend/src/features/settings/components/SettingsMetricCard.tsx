import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const toneClass = {
  neutral: "text-text-secondary",
  success: "text-emerald-600",
  warning: "text-warning",
  danger: "text-danger",
} as const;

export function SettingsMetricCard({
  label,
  value,
  secondary,
  icon: Icon,
  tone = "neutral",
  compact,
  className,
}: {
  label: string;
  value: string;
  secondary?: string;
  icon?: LucideIcon;
  tone?: keyof typeof toneClass;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-surface-border bg-surface p-3.5",
        compact ? "min-h-[68px]" : "min-h-[72px]",
        className,
      )}
    >
      {Icon ? (
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center", toneClass[tone])}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="text-[12px] font-medium leading-4 text-text-secondary">{label}</p>
        <p className="truncate text-[20px] font-bold leading-6 text-text-primary">{value}</p>
        {secondary ? <p className="mt-0.5 text-[11px] text-text-muted">{secondary}</p> : null}
      </div>
    </div>
  );
}
