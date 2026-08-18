import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import type { Citation } from "@/lib/api/types";
import { AIChatPanel } from "@/components/ask/AIChatPanel";
import { AskFoliumFab } from "@/components/ask/AskFoliumFab";
import { Button } from "@/components/ui/Button";

export function AskFoliumDock() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleCitation = (citation: Citation) => {
    const params = new URLSearchParams();
    params.set("doc", citation.document_id);
    if (citation.page_number && citation.page_number > 1) {
      params.set("viewerPage", String(citation.page_number));
    }
    navigate(`/documents?${params.toString()}`);
  };

  return (
    <>
      {!open && (
        <AskFoliumFab
          onClick={() => setOpen(true)}
          className="fixed right-5 bottom-5 z-40"
        />
      )}
      {open && (
        <div
          className="fixed right-4 bottom-4 z-50 flex h-[50vh] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[14px] border border-surface-border bg-surface shadow-[0_10px_30px_rgba(15,23,42,0.18)]"
          role="dialog"
          aria-label="Ask Folium"
        >
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2.5 right-2.5 z-10 h-8 w-8"
            aria-label="Close Ask Folium"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <AIChatPanel
            active={open}
            initialScope={{ kind: "library" }}
            onCitationClick={handleCitation}
            className="h-full"
          />
        </div>
      )}
    </>
  );
}
