import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDocumentUploader } from "@/lib/api/upload";
import { InboxOverview } from "./InboxOverview";
import { InboxWorkView } from "./InboxWorkView";
import { InboxToast } from "./InboxToast";
import {
  formatUploadToast,
  parseSessionRejections,
  type SessionRejection,
} from "./sessionRejections";

export function InboxPage() {
  const [searchParams] = useSearchParams();
  const isWork = searchParams.get("view") === "work";
  const uploader = useDocumentUploader();
  const [sessionRejections, setSessionRejections] = useState<SessionRejection[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const consumedSummaryRef = useRef<typeof uploader.lastSummary>(null);

  useEffect(() => {
    const summary = uploader.lastSummary;
    if (!summary || summary === consumedSummaryRef.current) return;
    consumedSummaryRef.current = summary;
    const rejects = parseSessionRejections(summary);
    if (rejects.length > 0) {
      setSessionRejections((prev) => [...rejects, ...prev]);
    }
    setToastMessage(formatUploadToast(summary));
    uploader.clearSummary();
  }, [uploader, uploader.lastSummary]);

  // Clear session rejects when leaving work mode.
  useEffect(() => {
    if (!isWork) setSessionRejections([]);
  }, [isWork]);

  return (
    <div className="h-full min-h-0">
      {isWork ? (
        <InboxWorkView
          uploader={uploader}
          sessionRejections={sessionRejections}
          onDismissRejection={(id) =>
            setSessionRejections((prev) => prev.filter((r) => r.id !== id))
          }
          onClearRejections={() => setSessionRejections([])}
          toastMessage={toastMessage}
          onDismissToast={() => setToastMessage(null)}
        />
      ) : (
        <>
          <InboxOverview uploader={uploader} />
          <InboxToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
        </>
      )}
    </div>
  );
}
