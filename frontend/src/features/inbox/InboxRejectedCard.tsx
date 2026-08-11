import { AlertCircle, FileWarning, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { SessionRejection } from "./sessionRejections";

interface InboxRejectedCardProps {
  rejection: SessionRejection;
  onDismiss: (id: string) => void;
}

export function InboxRejectedCard({ rejection, onDismiss }: InboxRejectedCardProps) {
  return (
    <div className="mb-3.5 rounded-xl border border-[#F3C2C5] bg-[#FDEBEC] p-5 shadow-[0_2px_6px_rgba(20,33,43,0.04)]">
      <div className="flex items-start gap-3.5">
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg bg-white/70">
          <FileWarning className="h-5 w-5 text-[#C6474A]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[17px] font-bold leading-snug text-[#14212B]">
              {rejection.filename}
            </h3>
            <span className="inline-flex h-[26px] items-center gap-1 rounded-md border border-[#F3C2C5] bg-[#FDEBEC] px-2.5 text-[11px] font-semibold text-[#C6474A]">
              <AlertCircle className="h-3 w-3" strokeWidth={1.75} />
              Rejected
            </span>
          </div>
          <p className="mt-1 text-xs text-[#C6474A]">{rejection.message}</p>
          <p className="mt-1 text-[11px] text-[#74828D]">
            Not added to the queue. Supported files in the same batch were still uploaded.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 text-[#C6474A] hover:bg-white/60"
          aria-label={`Dismiss ${rejection.filename}`}
          onClick={() => onDismiss(rejection.id)}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  );
}
