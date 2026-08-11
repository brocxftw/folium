import { Loader2 } from "lucide-react";
import type { Document, Job } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  PROCESSING_LABEL_TEXT,
  resolveProcessingLabel,
  type ProcessingLabel,
} from "./inboxPreparingPhases";

const BADGE =
  "inline-flex items-center gap-1 border py-0.5 h-[26px] rounded-md px-2.5 text-[11px] font-semibold";

const LABEL_STYLES: Record<ProcessingLabel, string> = {
  ocr: "border-[#C9DDF7] bg-[#EAF3FE] text-[#2D6DB5]",
  indexing: "border-[#C9DDF7] bg-[#EAF3FE] text-[#2D6DB5]",
  preparing: "border-[#C9DDF7] bg-[#EAF3FE] text-[#2D6DB5]",
  needs_review: "border-[#EFC66A] bg-[#FFF4D8] text-[#B26A00]",
  ready: "border-[#B9E3CC] bg-[#E8F7EF] text-[#198754]",
  failed: "border-[#F3C2C5] bg-[#FDEBEC] text-[#C6474A]",
};

interface InboxProcessingStatusBadgeProps {
  document: Document;
  jobs?: Job[];
  className?: string;
}

export function InboxProcessingStatusBadge({
  document,
  jobs,
  className,
}: InboxProcessingStatusBadgeProps) {
  const label = resolveProcessingLabel(document, jobs);
  const spinning = label === "ocr" || label === "indexing";

  return (
    <span className={cn(BADGE, LABEL_STYLES[label], className)}>
      {spinning && <Loader2 className="h-3 w-3 animate-spin" />}
      {PROCESSING_LABEL_TEXT[label]}
    </span>
  );
}
