import type { HTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const paddingClass = {
  none: "p-0",
  sm: "p-4",
  md: "p-5 sm:p-6",
} as const;

export function SettingsCard({
  children,
  className,
  padding = "md",
  interactive = false,
  to,
  onClick,
  ...props
}: {
  children: ReactNode;
  padding?: keyof typeof paddingClass;
  interactive?: boolean;
  to?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const classes = cn(
    "rounded-lg border border-surface-border bg-surface",
    paddingClass[padding],
    (interactive || to || onClick) &&
      "cursor-pointer transition-colors hover:bg-surface-hover",
    className,
  );

  if (to) {
    return (
      <Link to={to} className={cn(classes, "block no-underline text-inherit")}>
        {children}
      </Link>
    );
  }

  return (
    <div className={classes} onClick={onClick} {...props}>
      {children}
    </div>
  );
}
