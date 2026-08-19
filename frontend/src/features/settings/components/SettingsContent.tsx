import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsContent({
  width = "standard",
  className,
  children,
}: {
  width?: "standard" | "wide";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-8",
        width === "wide" ? "max-w-[1180px]" : "max-w-5xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
