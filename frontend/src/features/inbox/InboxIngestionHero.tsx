import { useNavigate } from "react-router-dom";
import {
  CloudUpload,
  Lightbulb,
  Lock,
  Rocket,
} from "lucide-react";
import { useAICapabilities } from "@/lib/api/hooks";
import type { useDocumentUploader } from "@/lib/api/upload";
import type { UploadEntry } from "@/lib/uploadTree";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { UploadDropzone } from "@/components/documents/UploadDropzone";

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
  const { data: aiPolicy, isFetching, refetch } = useAICapabilities();
  const aiReady = Boolean(aiPolicy?.auto_tagging && aiPolicy.chat_available);

  const handleEntries = async (entries: UploadEntry[]) => {
    const uploadPromise = uploader.uploadEntries(entries);
    navigate("/inbox?view=work");
    await uploadPromise;
  };

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(250px,0.8fr)_minmax(250px,0.8fr)] md:grid-cols-2">
      <UploadDropzone
        onEntries={(entries) => void handleEntries(entries)}
        disabled={uploader.busy}
        className="md:col-span-2 lg:col-span-1"
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
            "flex min-h-[248px] cursor-pointer flex-col items-center justify-center rounded-[10px] border border-dashed border-[#13B8AA] bg-white px-6 py-8 text-center shadow-[0_1px_3px_rgba(20,33,43,0.05)]",
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
          <p className="mt-5 flex items-center gap-1.5 text-[10px] text-[#74828D]">
            <Lock className="h-3 w-3" strokeWidth={1.75} />
            Your files are processed securely and never shared.
          </p>
        </div>
      </UploadDropzone>

      <div className="rounded-[10px] border border-[#DCE3E8] bg-white p-[18px]">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#07998E]" strokeWidth={1.75} />
          <h3 className="text-[13px] font-semibold text-[#14212B]">Ingestion tips</h3>
        </div>
        <ul className="mt-3 space-y-3">
          {TIPS.map((tip) => (
            <li key={tip} className="flex gap-2 text-xs leading-relaxed text-[#42515D]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#13B8AA]" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={cn(
          "rounded-[10px] border p-[18px]",
          aiReady
            ? "border-[#BFE9E2] bg-gradient-to-br from-[#F0FBF9] to-[#E6FAF6]"
            : "border-[#DCE3E8] bg-[#F3F6F8]",
        )}
      >
        <div className="flex items-center gap-2">
          <Rocket
            className={cn("h-4 w-4", aiReady ? "text-[#07998E]" : "text-[#74828D]")}
            strokeWidth={1.75}
          />
          <h3 className="text-[13px] font-semibold text-[#14212B]">
            {aiReady ? "AI is ready" : "AI suggestions unavailable"}
          </h3>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#42515D]">
          {aiReady
            ? "Your AI pipeline is online and ready to process documents."
            : "Filing suggestions are unavailable. Documents can still be uploaded and filed manually."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 h-[30px] border-[#13B8AA] bg-white text-[#087F78] hover:bg-[#F0FBF9]"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Check AI status
        </Button>
      </div>
    </div>
  );
}
