import { useSearchParams } from "react-router-dom";
import { useDocumentUploader } from "@/lib/api/upload";
import { InboxOverview } from "./InboxOverview";
import { InboxWorkView } from "./InboxWorkView";

export function InboxPage() {
  const [searchParams] = useSearchParams();
  const isWork = searchParams.get("view") === "work";
  const uploader = useDocumentUploader();

  return (
    <div className="h-full min-h-0">
      {isWork ? (
        <InboxWorkView uploader={uploader} />
      ) : (
        <InboxOverview uploader={uploader} />
      )}
    </div>
  );
}
