import { Button } from "@/components/ui/Button";
import type { AIAssignment } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { WORKLOAD_COPY } from "./workloadCopy";

function statusBadgeClass(status: AIAssignment["status"]): string {
  switch (status) {
    case "configured":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "offline":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "disabled":
      return "bg-surface-muted text-text-muted border-surface-border";
    default:
      return "bg-surface-muted text-text-secondary border-surface-border";
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
    <div className="flex flex-wrap items-start gap-4 rounded-lg border border-surface-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted"
        style={{ color: copy.iconColour }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{copy.title}</h3>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              statusBadgeClass(assignment.status),
            )}
          >
            {statusLabel(assignment.status)}
          </span>
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
      <Button size="sm" variant="secondary" onClick={onChangeModel}>
        Change model
      </Button>
    </div>
  );
}
