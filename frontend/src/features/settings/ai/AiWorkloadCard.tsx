import { ChevronRight, HardDrive, Server } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AIAssignment } from "@/lib/api/types";
import { SettingsCard, SettingsStatusBadge } from "@/features/settings/components";
import { cn } from "@/lib/utils";
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

function StatusDot({ tone }: { tone: "success" | "warning" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        tone === "success" && "bg-emerald-500",
        tone === "warning" && "bg-amber-500",
        tone === "neutral" && "bg-text-muted",
      )}
      aria-hidden
    />
  );
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
  const tone = statusTone(assignment.status);

  return (
    <SettingsCard padding="sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-secondary">
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">{copy.title}</h3>
              <SettingsStatusBadge tone={tone}>
                <StatusDot tone={tone} />
                {statusLabel(assignment.status)}
              </SettingsStatusBadge>
            </div>
            <p className="text-xs leading-5 text-text-secondary">{copy.subtitle}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 lg:max-w-xs">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Model</p>
          {configured ? (
            <>
              <p className="mt-0.5 truncate font-mono text-sm font-semibold text-text-primary">
                {assignment.model}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1 truncate">
                  <Server className="h-3 w-3 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
                  {assignment.provider_name || "Unknown provider"}
                </span>
                {assignment.is_local != null && (
                  <span className="inline-flex items-center gap-1">
                    <HardDrive className="h-3 w-3 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
                    {assignment.is_local ? "Local" : "Remote"}
                  </span>
                )}
                {assignment.embedding_dimension != null && (
                  <span>{assignment.embedding_dimension} dimensions</span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-text-muted">No model assigned yet.</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 lg:justify-end">
          <Button size="sm" variant="outline" onClick={onChangeModel}>
            Change model
          </Button>
          <ChevronRight className="hidden h-4 w-4 text-text-muted sm:block" strokeWidth={1.75} aria-hidden />
        </div>
      </div>
    </SettingsCard>
  );
}
