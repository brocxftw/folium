import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const toneClass = {
  neutral: "bg-surface-muted text-text-secondary",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-danger",
  info: "bg-sky-50 text-sky-800",
} as const;

export function SettingsStatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof toneClass;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
