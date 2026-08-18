import { useMemo, useState } from "react";
import { useAIAssignments } from "@/lib/api/hooks";
import type { AIAssignment } from "@/lib/api/types";
import { AiWorkloadCard } from "./AiWorkloadCard";
import { AssignmentDialog } from "./AssignmentDialog";

export function ModelsPanel() {
  const { data = [], isLoading, error } = useAIAssignments();
  const [editing, setEditing] = useState<AIAssignment | null>(null);
  const visible = useMemo(
    () => data.filter((item) => item.role !== "vision"),
    [data],
  );

  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading assignments…</p>;
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        Model assignments are unavailable.
      </p>
    );
  }

  return (
    <section aria-labelledby="workloads-heading" className="space-y-4">
      <div>
        <h2 id="workloads-heading" className="text-base font-semibold text-text-primary">
          AI workloads
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Each workload routes independently. No fallback is configured.
        </p>
      </div>
      <div className="space-y-3">
        {visible.map((assignment) => (
          <AiWorkloadCard
            key={assignment.role}
            assignment={assignment}
            onChangeModel={() => setEditing(assignment)}
          />
        ))}
      </div>
      {editing && (
        <AssignmentDialog assignment={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
