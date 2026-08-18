import { useMemo, useState } from "react";
import { Activity, Clock, Coins, Layers } from "lucide-react";
import { useAIUsage } from "@/lib/api/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { AiBreakdownPanel } from "./AiBreakdownPanel";
import { AiKpiCard } from "./AiKpiCard";
import { workloadDisplayLabel } from "./workloadCopy";

type UsageRange = "today" | "7d" | "30d" | "month";

function UsageAreaChart({ points }: { points: Array<{ bucket: string; requests: number }> }) {
  const max = Math.max(1, ...points.map((point) => point.requests));
  const width = 640;
  const height = 200;
  const padding = { top: 16, bottom: 24, left: 8, right: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const coords = points.map((point, index) => {
    const x =
      points.length <= 1
        ? padding.left + chartW / 2
        : padding.left + (index / (points.length - 1)) * chartW;
    const y =
      padding.top + chartH - (point.requests / max) * chartH;
    return { x, y, ...point };
  });

  const linePath = coords
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${padding.top + chartH} L ${coords[0].x} ${padding.top + chartH} Z`
      : "";

  return (
    <div className="rounded-lg border border-surface-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-text-primary">Requests over time</h3>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-52 w-full"
        role="img"
        aria-labelledby="usage-chart-title"
      >
        <title id="usage-chart-title">AI requests over time</title>
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + chartH * (1 - fraction)}
            y2={padding.top + chartH * (1 - fraction)}
            stroke="var(--color-surface-border)"
            strokeWidth="1"
          />
        ))}
        {areaPath && (
          <path d={areaPath} fill="var(--color-accent-muted)" fillOpacity="0.45" />
        )}
        {linePath && (
          <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
        )}
      </svg>
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.bucket}>
            {new Date(point.bucket).toLocaleString()}: {point.requests} requests
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)} ms`;
}

function PerformanceCard({
  title,
  avgLabel,
  avgValue,
  countLabel,
  countValue,
}: {
  title: string;
  avgLabel: string;
  avgValue: string;
  countLabel: string;
  countValue: string;
}) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-text-muted">{avgLabel}</dt>
          <dd className="font-medium text-text-primary">{avgValue}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">{countLabel}</dt>
          <dd className="font-medium text-text-primary">{countValue}</dd>
        </div>
      </dl>
    </div>
  );
}

export function UsagePanel() {
  const [range, setRange] = useState<UsageRange>("month");
  const { data, isLoading, error } = useAIUsage(range);

  const workloadMap = useMemo(() => {
    const map = new Map<string, { requests: number; duration_ms: number | null }>();
    for (const item of data?.by_workload ?? []) {
      map.set(item.key, {
        requests: item.requests,
        duration_ms: item.duration_ms ?? null,
      });
    }
    return map;
  }, [data?.by_workload]);

  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading deployment usage…</p>;
  }
  if (error || !data) {
    return (
      <p role="alert" className="text-sm text-danger">
        Usage data is unavailable.
      </p>
    );
  }

  const totals = data.totals;
  const avgPerRequest =
    totals.duration_ms != null && totals.requests > 0
      ? formatDuration(totals.duration_ms / totals.requests)
      : null;

  const costPrimary =
    totals.cost_coverage === "local_only"
      ? "Unavailable"
      : totals.estimated_cost == null
        ? "Unavailable"
        : `${totals.estimated_cost.toFixed(4)} ${totals.cost_currency || ""}`.trim();

  const costSecondary =
    totals.cost_coverage === "local_only"
      ? "Local models"
      : totals.cost_coverage === "none"
        ? "No cost data recorded"
        : "Total tokens processed";

  const chat = workloadMap.get("chat");
  const indexing = workloadMap.get("indexing");
  const embeddings = workloadMap.get("embeddings");

  const chatAvg =
    chat?.duration_ms != null && chat.requests > 0
      ? formatDuration(chat.duration_ms / chat.requests)
      : "Unavailable";
  const filingAvg =
    indexing?.duration_ms != null && indexing.requests > 0
      ? formatDuration(indexing.duration_ms / indexing.requests)
      : "Unavailable";
  const embedAvg =
    embeddings?.duration_ms != null && embeddings.requests > 0
      ? formatDuration(embeddings.duration_ms / embeddings.requests)
      : "Unavailable";

  return (
    <section aria-labelledby="usage-heading" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="usage-heading" className="sr-only">
            Usage
          </h2>
          <p className="text-sm text-text-secondary">All AI workloads · UTC</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="usage-range" className="text-xs text-text-muted">
            Time range
          </label>
          <Select value={range} onValueChange={(value) => setRange(value as UsageRange)}>
            <SelectTrigger id="usage-range" className="w-36" aria-label="Usage range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AiKpiCard
          label="Requests"
          value={totals.requests.toLocaleString()}
          secondary="In selected period"
          icon={Activity}
        />
        <AiKpiCard
          label="Tokens"
          value={
            totals.input_tokens == null && totals.output_tokens == null
              ? "Unavailable"
              : `${(totals.input_tokens || 0).toLocaleString()} in · ${(totals.output_tokens || 0).toLocaleString()} out`
          }
          secondary="Total tokens processed"
          icon={Layers}
        />
        <AiKpiCard
          label="AI time"
          value={
            totals.duration_ms == null
              ? "Unavailable"
              : `${(totals.duration_ms / 1000).toLocaleString()} s`
          }
          secondary={avgPerRequest ? `avg ${avgPerRequest} / request` : "Processing time"}
          icon={Clock}
        />
        <AiKpiCard
          label="Estimated cost"
          value={costPrimary}
          secondary={costSecondary}
          icon={Coins}
        />
      </div>

      {totals.requests === 0 ? (
        <p className="rounded-lg border border-dashed border-surface-border bg-surface p-10 text-center text-sm text-text-muted">
          No AI requests yet for this period. Document management continues to work without AI activity.
        </p>
      ) : (
        <UsageAreaChart points={data.time_series} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <AiBreakdownPanel
          title="Workload breakdown"
          values={data.by_workload}
          totalRequests={totals.requests}
        />
        <AiBreakdownPanel
          title="Provider breakdown"
          values={data.by_provider.map((p) => ({
            key: p.key,
            label: p.label,
            requests: p.requests,
          }))}
          totalRequests={totals.requests}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Performance</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <PerformanceCard
            title={workloadDisplayLabel("chat")}
            avgLabel="avg"
            avgValue={chatAvg}
            countLabel="requests"
            countValue={chat ? chat.requests.toLocaleString() : "0"}
          />
          <PerformanceCard
            title={workloadDisplayLabel("indexing")}
            avgLabel="avg"
            avgValue={filingAvg}
            countLabel="completed"
            countValue={indexing ? indexing.requests.toLocaleString() : "0"}
          />
          <PerformanceCard
            title={workloadDisplayLabel("embeddings")}
            avgLabel="avg"
            avgValue={embedAvg}
            countLabel="requests"
            countValue={embeddings ? embeddings.requests.toLocaleString() : "0"}
          />
        </div>
      </div>

      {totals.cost_coverage === "partial" && (
        <p className="text-xs text-warning">
          Cost coverage is partial; unknown remote costs are excluded.
        </p>
      )}
    </section>
  );
}
