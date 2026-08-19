import { Button } from "@/components/ui/Button";
import type { AIAssignment } from "@/lib/api/types";
import { SettingsCard, SettingsStatusBadge } from "@/features/settings/components";
import { WORKLOAD_COPY } from "./workloadCopy";

function statusTone(status: AIAssignment["status"]): "success" | "warning" | "neutral" {
  switch (status) {
    case "configured":
      return "success";
    case "offline":
      return "warning";
    default:
      return "neutral";
  }
}

function statusLabel(status: AIAssignment["status"]): string {
  switch (status) {
    case "configured":
      return "Available";
    case "unconfigured":
      return "Not configured";
    case "offline":
      return "Offline";
    case "disabled":
      return "Disabled";
    default:
      return status;
  }
}

export function AiWorkloadCard({
  assignment,
  onChangeModel,
}: {
  assignment: AIAssignment;
  onChangeModel: () => void;
}) {
  const copy = WORKLOAD_COPY[assignment.role];
  const Icon = copy.icon;
  const configured = assignment.status === "configured" && assignment.model;

  const providerLine = [
    assignment.provider_name || "Not configured",
    assignment.is_local == null ? null : assignment.is_local ? "Local" : "Remote",
    assignment.embedding_dimension ? `${assignment.embedding_dimension} dimensions` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SettingsCard padding="sm">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-secondary">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary">{copy.title}</h3>
            <SettingsStatusBadge tone={statusTone(assignment.status)}>
              {statusLabel(assignment.status)}
            </SettingsStatusBadge>
          </div>
          <p className="text-xs text-text-secondary">{copy.subtitle}</p>
          {configured ? (
            <>
              <p className="pt-1 text-base font-semibold text-text-primary">{assignment.model}</p>
              <p className="text-xs text-text-muted">{providerLine}</p>
            </>
          ) : (
            <p className="pt-1 text-sm text-text-muted">No model assigned yet.</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onChangeModel}>
          Change model
        </Button>
      </div>
    </SettingsCard>
  );
}
