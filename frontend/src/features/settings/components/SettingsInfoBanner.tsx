import { Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsInfoBanner({
  children,
  icon: Icon = Info,
  tone = "info",
  className,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: "info" | "warning" | "danger" | "muted";
  className?: string;
}) {
  const tones = {
    info: "border-sky-100 bg-sky-50/80 text-text-secondary",
    warning: "border-amber-100 bg-amber-50 text-amber-900",
    danger: "border-red-100 bg-red-50 text-danger",
    muted: "border-surface-border bg-surface text-text-secondary",
  };
  const iconTones = {
    info: "text-sky-700",
    warning: "text-warning",
    danger: "text-danger",
    muted: "text-text-muted",
  };
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12px] leading-5",
        tones[tone],
        className,
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconTones[tone])} strokeWidth={1.75} />
      <div>{children}</div>
    </div>
  );
}
