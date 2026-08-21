import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsRow({
  icon: Icon,
  title,
  description,
  action,
  iconClassName,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  iconClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-3 first:pt-0 last:pb-0", className)}>
      {Icon ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center text-text-secondary">
          <Icon className={cn("h-[18px] w-[18px]", iconClassName)} strokeWidth={1.75} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {description ? (
          <div className="mt-0.5 text-xs leading-5 text-text-secondary">{description}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
