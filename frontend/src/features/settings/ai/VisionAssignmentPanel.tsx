import { useState } from "react";
import { useAIAssignments } from "@/lib/api/hooks";
import { Button } from "@/components/ui/Button";
import { AssignmentDialog } from "./AssignmentDialog";

export function VisionAssignmentPanel() {
  const { data = [] } = useAIAssignments();
  const vision = data.find((item) => item.role === "vision");
  const [editing, setEditing] = useState(false);

  if (!vision) return null;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-text-primary">Legacy vision assignment</h3>
        <p className="mt-0.5 text-xs text-text-muted">
          {vision.provider_name || "Not configured"} · {vision.model || "No model"} ·{" "}
          {vision.status}
        </p>
        <p className="mt-2 text-xs text-text-secondary">
          Vision remains experimental until a defined processing workflow is available.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        Change vision model
      </Button>
      {editing && <AssignmentDialog assignment={vision} onClose={() => setEditing(false)} />}
    </div>
  );
}
