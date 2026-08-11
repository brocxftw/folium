import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb } from "lucide-react";
import { useAIHealth, useJobs, useSession } from "@/lib/api/hooks";
import type { AICapabilityHealth, AICapabilityStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

const TIPS = [
  "Upload clear, legible documents for best results.",
  "PDFs with selectable text are typically processed faster.",
  "Large batches may remain queued while processing capacity is busy.",
  "Processing progress can be monitored from this workspace.",
];

type PipelineKey = "ocr" | "indexing" | "embedding" | "chat";

const PIPELINE_ROWS: { key: PipelineKey; label: string }[] = [
  { key: "ocr", label: "OCR" },
  { key: "indexing", label: "Indexing" },
  { key: "embedding", label: "Embedding" },
  { key: "chat", label: "Chat" },
];

/** Background jobs that mean the AI / ingest pipeline is actively working. */
const AI_ACTIVE_JOB_TYPES = new Set([
  "ocr",
  "metadata_suggestion",
  "embedding",
  "indexing",
  "summary",
]);

function capabilityReady(status: AICapabilityStatus | undefined): boolean {
  return status === "available";
}

function capabilityLabel(cap: AICapabilityHealth | undefined): string {
  if (!cap) return "Checking…";
  if (cap.status === "not_configured") return "Not configured";
  if (cap.status === "checking") return "Checking…";
  if (cap.status === "unavailable") return cap.error?.trim() || "Unavailable";
  return cap.model?.trim() || cap.provider || "Available";
}

function StatusDot({
  working,
  ready,
  checking,
  label,
}: {
  working: boolean;
  ready: boolean;
  checking?: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        working || checking
          ? "animate-pulse bg-amber-400"
          : ready
            ? "bg-emerald-400"
            : "bg-sidebar-muted",
      )}
      title={working ? "Working" : checking ? "Checking" : ready ? "Ready" : label}
    />
  );
}

function StatusPill({
  working,
  ready,
  partial,
}: {
  working: boolean;
  ready: boolean;
  partial: boolean;
}) {
  const label = working ? "Working" : ready ? "Ready" : partial ? "Partial" : "Offline";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        working && "animate-pulse bg-amber-400/20 text-amber-300",
        !working && ready && "bg-emerald-400/15 text-emerald-300",
        !working && !ready && partial && "bg-amber-400/15 text-amber-300/90",
        !working && !ready && !partial && "bg-sidebar-hover text-sidebar-muted",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          working && "bg-amber-400",
          !working && ready && "bg-emerald-400",
          !working && !ready && partial && "bg-amber-400",
          !working && !ready && !partial && "bg-sidebar-muted",
        )}
      />
      {label}
    </span>
  );
}

/** Compact AI workload status for the app sidebar (replaces Tags). */
export function SidebarAiPipeline() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const isAdmin = Boolean(session?.user.is_admin);
  const { data: aiHealth } = useAIHealth();
  const { data: runningJobs = [] } = useJobs("running");
  const { data: queuedJobs = [] } = useJobs("queued");

  const pipelineRows = PIPELINE_ROWS.map(({ key, label }) => {
    const cap = aiHealth?.[key];
    return {
      key,
      label,
      detail: capabilityLabel(cap),
      ready: capabilityReady(cap?.status),
      checking: cap?.status === "checking",
      notConfigured: cap?.status === "not_configured",
    };
  });

  const aiWorking = useMemo(() => {
    const jobs = [...runningJobs, ...queuedJobs];
    return jobs.some((j) => AI_ACTIVE_JOB_TYPES.has(j.job_type));
  }, [runningJobs, queuedJobs]);

  const roleWorking = useMemo(() => {
    const jobs = [...runningJobs, ...queuedJobs];
    const types = new Set(jobs.map((j) => j.job_type));
    return {
      ocr: types.has("ocr"),
      indexing:
        types.has("metadata_suggestion") ||
        types.has("summary") ||
        types.has("indexing"),
      embedding: types.has("embedding"),
      chat: false,
    };
  }, [runningJobs, queuedJobs]);

  const suggestionsReady = Boolean(
    aiHealth?.auto_tagging && aiHealth.indexing.status === "available",
  );
  const configuredRows = pipelineRows.filter((r) => !r.notConfigured);
  const anyAvailable = configuredRows.some((r) => r.ready);
  const allConfiguredReady =
    configuredRows.length > 0 && configuredRows.every((r) => r.ready);
  const settingsPath = isAdmin
    ? "/settings/artificial-intelligence"
    : "/settings/about";

  return (
    <div className="border-t border-sidebar-border py-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="w-full rounded-md px-1 py-0.5 text-left transition-colors hover:bg-sidebar-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            aria-label="Open AI settings"
            onClick={() => navigate(settingsPath)}
          >
            <div className="px-2 py-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-sidebar-muted">
                  AI
                </span>
                <StatusPill
                  working={aiWorking}
                  ready={allConfiguredReady}
                  partial={anyAvailable && !allConfiguredReady}
                />
                <Lightbulb className="ml-auto h-3 w-3 shrink-0 text-sidebar-muted" strokeWidth={1.75} />
              </div>
            </div>

            <ul className="mt-0.5 space-y-0.5 px-1 pb-1">
              {pipelineRows.map((row) => {
                const working = roleWorking[row.key];
                return (
                  <li
                    key={row.key}
                    className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] leading-snug"
                  >
                    <StatusDot
                      working={working}
                      ready={row.ready}
                      checking={row.checking}
                      label={row.detail}
                    />
                    <span className="w-[58px] shrink-0 font-medium text-sidebar-text">
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        row.ready ? "text-sidebar-text/90" : "text-sidebar-muted",
                      )}
                      title={row.detail}
                    >
                      {row.detail}
                    </span>
                  </li>
                );
              })}
            </ul>

            {!isAdmin && (
              <p className="mt-0.5 px-2 pb-1 text-[11px] leading-snug text-sidebar-muted">
                {aiWorking
                  ? "AI is processing documents…"
                  : suggestionsReady
                    ? "AI suggestions are available."
                    : "AI suggestions unavailable — manual filing still works."}
              </p>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[260px] space-y-1.5 p-3">
          <p className="text-[11px] font-semibold text-white">Ingestion tips</p>
          <ul className="space-y-1.5">
            {TIPS.map((tip) => (
              <li key={tip} className="flex gap-1.5 text-[11px] leading-snug text-white/85">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
