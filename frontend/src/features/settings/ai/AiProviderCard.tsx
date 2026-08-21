import {
  Cloud,
  Monitor,
  MoreHorizontal,
  Network,
  Pencil,
  Server,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { AIProvider, AIProviderKind } from "@/lib/api/types";
import { SettingsCard, SettingsStatusBadge } from "@/features/settings/components";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  AIProviderKind,
  { label: string; icon: LucideIcon; iconWrap: string }
> = {
  ollama: {
    label: "Ollama",
    icon: Server,
    iconWrap: "bg-emerald-50 text-emerald-700",
  },
  openai_compatible: {
    label: "OpenAI Compatible",
    icon: Monitor,
    iconWrap: "bg-violet-50 text-violet-700",
  },
  openai: {
    label: "OpenAI",
    icon: Sparkles,
    iconWrap: "bg-emerald-50 text-emerald-700",
  },
  openrouter: {
    label: "OpenRouter",
    icon: Network,
    iconWrap: "bg-slate-100 text-slate-600",
  },
  anthropic: {
    label: "Anthropic",
    icon: Cloud,
    iconWrap: "bg-orange-50 text-orange-700",
  },
  gemini: {
    label: "Google Gemini",
    icon: Sparkles,
    iconWrap: "bg-sky-50 text-sky-700",
  },
};

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

function StatusDot({ tone }: { tone: "success" | "neutral" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        tone === "success" && "bg-emerald-500",
        tone === "neutral" && "bg-text-muted",
        tone === "warning" && "bg-amber-500",
      )}
      aria-hidden
    />
  );
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
  const kind = KIND_META[provider.kind as AIProviderKind] ?? {
    label: provider.kind.replace(/_/g, " "),
    icon: Server,
    iconWrap: "bg-surface-muted text-text-secondary",
  };
  const KindIcon = kind.icon;
  const usedByLine = [
    `Used by: ${usedBy.length > 0 ? usedBy.join(", ") : "None"}`,
    provider.last_probe_latency_ms != null ? `${provider.last_probe_latency_ms} ms` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SettingsCard padding="sm">
      <div className="flex flex-wrap items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            kind.iconWrap,
          )}
        >
          <KindIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{provider.name}</span>
            <SettingsStatusBadge tone="info">{kind.label}</SettingsStatusBadge>
            {provider.is_local && <SettingsStatusBadge>Local</SettingsStatusBadge>}
            {!provider.enabled && <SettingsStatusBadge>Disabled</SettingsStatusBadge>}
            <SettingsStatusBadge tone={health.tone}>
              <StatusDot tone={health.tone} />
              {health.label}
            </SettingsStatusBadge>
          </div>

          <a
            href={provider.base_url}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-mono text-xs text-accent hover:underline"
          >
            {provider.base_url}
          </a>

          <p className="text-xs text-text-secondary">{usedByLine}</p>

          {testMessage && (
            <p className={cn("text-xs", testOk ? "text-emerald-700" : "text-danger")}>
              {testMessage}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
            Test
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={`More actions for ${provider.name}`}>
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
