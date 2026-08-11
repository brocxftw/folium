import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Document, InboxStatus, Job } from "@/lib/api/types";
import { InboxProcessingStatusBadge } from "./InboxProcessingStatusBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

const LABELS: Record<InboxStatus, string> = {
  preparing: "Preparing",
  ready: "Ready",
  needs_review: "Needs review",
  failed: "Failed",
};

const STYLES: Record<InboxStatus, string> = {
  preparing: "bg-sky-50 text-sky-800 border-sky-200",
  ready: "bg-emerald-50 text-emerald-800 border-emerald-200",
  needs_review: "bg-amber-50 text-amber-900 border-amber-200",
  failed: "bg-red-50 text-red-800 border-red-200",
};

interface InboxStatusBadgeProps {
  status: InboxStatus | null | undefined;
  error?: string | null;
  className?: string;
  document?: Document;
  jobs?: Job[];
}

export function InboxStatusBadge({
  status,
  error,
  className,
  document,
  jobs,
}: InboxStatusBadgeProps) {
  if (!status) return <span className="text-xs text-text-muted">—</span>;

  if (document) {
    return <InboxProcessingStatusBadge document={document} jobs={jobs} className={className} />;
  }

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium",
        STYLES[status],
        className,
      )}
    >
      {status === "preparing" && <Loader2 className="h-3 w-3 animate-spin" />}
      {LABELS[status]}
    </span>
  );

  if (status === "failed" && error) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs">{error}</TooltipContent>
      </Tooltip>
    );
  }

  if (status === "needs_review") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>Assign a folder or complete missing filing fields</TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
