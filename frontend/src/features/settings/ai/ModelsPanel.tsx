import { useMemo, useState } from "react";
import {
  SettingsInfoBanner,
  SettingsSection,
} from "@/features/settings/components";
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
    <SettingsSection
      id="workloads"
      title="AI workloads"
      description="Choose which model Folium uses for each AI capability."
    >
      <div className="space-y-3">
        {visible.map((assignment) => (
          <AiWorkloadCard
            key={assignment.role}
            assignment={assignment}
            onChangeModel={() => setEditing(assignment)}
          />
        ))}
      </div>

      <SettingsInfoBanner tone="info" className="mt-1">
        <p className="font-medium text-text-primary">About workloads</p>
        <p className="mt-0.5">
          Each workload routes independently to its assigned provider and model. There is no automatic
          fallback between workloads.
        </p>
      </SettingsInfoBanner>

      {editing && (
        <AssignmentDialog assignment={editing} onClose={() => setEditing(null)} />
      )}
    </SettingsSection>
  );
}
