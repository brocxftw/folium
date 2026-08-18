import { useMemo } from "react";
import { HardDrive, Server } from "lucide-react";
import { useAIAssignments, useAIHealth, useAIPolicy } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

function StatusDot({ tone }: { tone: "success" | "warning" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        tone === "success" && "bg-emerald-500",
        tone === "warning" && "bg-amber-500",
        tone === "muted" && "bg-text-muted",
      )}
      aria-hidden
    />
  );
}

function BannerItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-text-secondary">{children}</span>
  );
}

export function AiStatusBanner() {
  const { data: health } = useAIHealth();
  const { data: assignments = [] } = useAIAssignments();
  const { data: policy } = useAIPolicy();

  const { availabilityLabel, availabilityTone } = useMemo(() => {
    if (!health) {
      return { availabilityLabel: "Checking AI status…", availabilityTone: "muted" as const };
    }
    const aiCaps = [health.indexing, health.embedding, health.chat] as const;
    const available = aiCaps.filter((c) => c.status === "available").length;
    const configured = aiCaps.filter((c) => c.status !== "not_configured").length;
    if (available === 3) {
      return { availabilityLabel: "AI available", availabilityTone: "success" as const };
    }
    if (available > 0 || configured > 0) {
      return { availabilityLabel: "AI partially available", availabilityTone: "warning" as const };
    }
    return { availabilityLabel: "AI unavailable", availabilityTone: "muted" as const };
  }, [health]);

  const configuredCount = useMemo(
    () =>
      assignments.filter(
        (a) =>
          a.role !== "vision" &&
          a.status === "configured" &&
          a.provider_id &&
          a.model,
      ).length,
    [assignments],
  );

  const localityLabel = useMemo(() => {
    if (!policy) return "Local-first";
    if (policy.privacy_mode === "local_only" || policy.privacy_mode === "private_hybrid") {
      return "Local-first";
    }
    if (policy.block_remote_ai) return "Local-first";
    return "Remote allowed";
  }, [policy]);

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-surface-border bg-surface px-4 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      role="status"
      aria-live="polite"
    >
      <BannerItem>
        <StatusDot tone={availabilityTone} />
        {availabilityLabel}
      </BannerItem>
      <span className="hidden h-4 w-px bg-surface-border sm:block" aria-hidden />
      <BannerItem>
        {configuredCount} workload{configuredCount === 1 ? "" : "s"} configured
      </BannerItem>
      <span className="hidden h-4 w-px bg-surface-border sm:block" aria-hidden />
      <BannerItem>
        {localityLabel === "Local-first" ? (
          <HardDrive className="h-3.5 w-3.5 text-text-muted" aria-hidden />
        ) : (
          <Server className="h-3.5 w-3.5 text-text-muted" aria-hidden />
        )}
        {localityLabel}
      </BannerItem>
    </div>
  );
}
