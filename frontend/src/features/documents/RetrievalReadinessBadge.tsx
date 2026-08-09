import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { getReadinessInfo, type ReadinessInfo } from "@/features/documents/retrievalReadiness";
import type { Document } from "@/lib/api/types";

const TONE_CLASS: Record<ReadinessInfo["tone"], string> = {
  muted: "bg-surface-muted text-text-secondary",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  accent: "bg-accent/15 text-accent",
  success: "bg-emerald-50 text-emerald-800",
};

interface RetrievalReadinessBadgeProps {
  document: Document;
  className?: string;
  showLabel?: boolean;
}

export function RetrievalReadinessBadge({
  document,
  className,
  showLabel = true,
}: RetrievalReadinessBadgeProps) {
  const info = getReadinessInfo(document);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
            TONE_CLASS[info.tone],
            className,
          )}
        >
          {showLabel ? info.label : info.key}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {info.description}
      </TooltipContent>
    </Tooltip>
  );
}
