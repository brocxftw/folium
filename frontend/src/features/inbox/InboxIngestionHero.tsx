import { useNavigate } from "react-router-dom";
import { CloudUpload, Lightbulb, Lock } from "lucide-react";
import type { useDocumentUploader } from "@/lib/api/upload";
import type { UploadEntry } from "@/lib/uploadTree";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { UploadDropzone } from "@/components/documents/UploadDropzone";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

type DocumentUploader = ReturnType<typeof useDocumentUploader>;

const TIPS = [
  "Upload clear, legible documents for best results.",
  "PDFs with selectable text are typically processed faster.",
  "Large batches may remain queued while processing capacity is busy.",
  "Processing progress can be monitored from this workspace.",
];

interface InboxIngestionHeroProps {
  uploader: DocumentUploader;
  onBrowse: () => void;
}

export function InboxIngestionHero({ uploader, onBrowse }: InboxIngestionHeroProps) {
  const navigate = useNavigate();

  const handleEntries = async (entries: UploadEntry[]) => {
    const uploadPromise = uploader.uploadEntries(entries);
    navigate("/inbox?view=work");
    await uploadPromise;
  };

  return (
    <div className="mt-5">
      <UploadDropzone
        onEntries={(entries) => void handleEntries(entries)}
        disabled={uploader.busy}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={onBrowse}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onBrowse();
            }
          }}
          className={cn(
            "flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-[10px] border border-dashed border-[#13B8AA] bg-white px-6 py-8 text-center shadow-[0_1px_3px_rgba(20,33,43,0.05)]",
            "transition-colors hover:border-[#07998E] hover:bg-[#F0FBF9]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07998E]",
          )}
        >
          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#DDF7F3]">
            <CloudUpload className="h-7 w-7 text-[#07998E]" strokeWidth={1.75} />
          </div>
          <h2 className="mt-3.5 text-[17px] font-bold leading-tight text-[#14212B]">
            Drag & drop documents here
          </h2>
          <p className="mt-1 text-xs text-[#42515D]">or click to browse</p>
          <p className="mt-1 text-[11px] text-[#74828D]">
            Supports PDF, DOCX, TXT, CSV, JPG, PNG and more
          </p>
          <Button
            type="button"
            className="mt-4 h-8 rounded-md bg-[#07998E] px-[18px] hover:bg-[#087F78]"
            disabled={uploader.busy}
            onClick={(e) => {
              e.stopPropagation();
              onBrowse();
            }}
          >
            Browse files
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className="mt-5 inline-flex items-center gap-1.5 text-[10px] font-medium text-[#087F78] hover:text-[#07998E]"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Lightbulb className="h-3 w-3" strokeWidth={1.75} />
                Upload tips
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[280px] space-y-1.5 p-3">
              <p className="text-[11px] font-semibold text-white">Ingestion tips</p>
              <ul className="space-y-1.5 text-left">
                {TIPS.map((tip) => (
                  <li key={tip} className="flex gap-1.5 text-[11px] leading-snug text-white/85">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[#74828D]">
            <Lock className="h-3 w-3" strokeWidth={1.75} />
            Your files are processed securely and never shared.
          </p>
        </div>
      </UploadDropzone>
    </div>
  );
}
