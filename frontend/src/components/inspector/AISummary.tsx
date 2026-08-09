import { Sparkles } from "lucide-react";
import type { Document } from "@/lib/api/types";

interface AISummaryProps {
  document: Document;
}

export function AISummary({ document }: AISummaryProps) {
  if (!document.ai_summary) {
    return (
      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          <Sparkles className="h-3 w-3" />
          AI Summary
        </h4>
        <p className="text-[13px] text-text-muted leading-relaxed">
          No summary available. Enable auto-enrichment in AI settings or wait for processing to complete.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        <Sparkles className="h-3 w-3" />
        AI Summary
      </h4>
      <p className="text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap">
        {document.ai_summary}
      </p>
    </div>
  );
}
