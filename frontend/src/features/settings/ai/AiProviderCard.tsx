import { MoreHorizontal, Pencil, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { AIProvider } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function probeStatusLabel(status: string | null | undefined): { label: string; tone: "success" | "neutral" | "warning" } {
  if (!status || status === "not tested") {
    return { label: "Not tested", tone: "neutral" };
  }
  if (status === "available") {
    return { label: "Available", tone: "success" };
  }
  return { label: status, tone: "warning" };
}

export function AiProviderCard({
  provider,
  usedBy,
  onTest,
  onEdit,
  onToggle,
  onDelete,
  testing,
  testMessage,
  testOk,
}: {
  provider: AIProvider;
  usedBy: string[];
  onTest: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  testing: boolean;
  testMessage?: string;
  testOk?: boolean;
}) {
  const health = probeStatusLabel(provider.last_probe_status);

  return (
    <div className="rounded-lg border border-surface-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-text-primary">{provider.name}</span>
            <span className="text-xs capitalize text-text-muted">
              {provider.kind.replace(/_/g, " ")}
            </span>
            {provider.is_local && (
              <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent">
                local
              </span>
            )}
            {!provider.enabled && (
              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-muted">
                disabled
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                health.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                health.tone === "neutral" && "border-surface-border bg-surface-muted text-text-secondary",
                health.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  health.tone === "success" && "bg-emerald-500",
                  health.tone === "neutral" && "bg-text-muted",
                  health.tone === "warning" && "bg-amber-500",
                )}
              />
              {health.label}
            </span>
          </div>
          <p className="truncate font-mono text-xs text-text-muted">{provider.base_url}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
            <span>
              Used by:{" "}
              {usedBy.length > 0 ? usedBy.join(", ") : "None"}
            </span>
            {provider.last_probe_latency_ms != null && (
              <span>{provider.last_probe_latency_ms} ms</span>
            )}
          </div>
          {testMessage && (
            <p className={cn("text-xs", testOk ? "text-accent" : "text-danger")}>{testMessage}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onTest} disabled={testing}>
            <Zap className="mr-1 h-3.5 w-3.5" />
            Test
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`More actions for ${provider.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggle}>
                {provider.enabled ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-danger focus:text-danger">
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
