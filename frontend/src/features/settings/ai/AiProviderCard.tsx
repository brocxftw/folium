import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { AIProvider } from "@/lib/api/types";
import { SettingsCard, SettingsStatusBadge } from "@/features/settings/components";
import { cn } from "@/lib/utils";

function probeStatus(status: string | null | undefined): {
  label: string;
  tone: "success" | "neutral" | "warning";
} {
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
  const health = probeStatus(provider.last_probe_status);

  return (
    <SettingsCard padding="sm">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-text-primary">{provider.name}</span>
            <span className="text-xs capitalize text-text-muted">{provider.kind.replace(/_/g, " ")}</span>
            {provider.is_local && <SettingsStatusBadge>Local</SettingsStatusBadge>}
            {!provider.enabled && <SettingsStatusBadge>Disabled</SettingsStatusBadge>}
            <SettingsStatusBadge tone={health.tone}>{health.label}</SettingsStatusBadge>
          </div>
          <p className="truncate font-mono text-xs text-text-muted">{provider.base_url}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
            <span>Used by: {usedBy.length > 0 ? usedBy.join(", ") : "None"}</span>
            {provider.last_probe_latency_ms != null && <span>{provider.last_probe_latency_ms} ms</span>}
          </div>
          {testMessage && (
            <p className={cn("text-xs", testOk ? "text-emerald-700" : "text-danger")}>{testMessage}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
            Test
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
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
    </SettingsCard>
  );
}
