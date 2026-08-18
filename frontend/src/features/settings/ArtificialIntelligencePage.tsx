import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useAIAssignments,
  useAIProviders,
  useAIUsage,
  useProviderModels,
  useUpdateAIAssignment,
} from "@/lib/api/hooks";
import type { AIAssignment, AIWorkloadRole } from "@/lib/api/types";
import { AIProvidersSettings } from "@/components/settings/AIProvidersSettings";
import { AIPolicySettings } from "@/components/settings/AIPolicySettings";
import { AIProfilesSettings } from "@/components/settings/AIProfilesSettings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

const TABS = ["usage", "models", "advanced"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  usage: "Usage",
  models: "Models",
  advanced: "Advanced",
};
const LEGACY_TABS: Record<string, Tab> = {
  providers: "models",
  policy: "advanced",
};

function resolveTab(raw: string | null): Tab {
  if (raw && TABS.includes(raw as Tab)) return raw as Tab;
  if (raw && raw in LEGACY_TABS) return LEGACY_TABS[raw];
  return "usage";
}

type UsageRange = "today" | "7d" | "30d" | "month";

function UsageChart({ points }: { points: Array<{ bucket: string; requests: number }> }) {
  const max = Math.max(1, ...points.map((point) => point.requests));
  const width = 640;
  const height = 180;
  const path = points
    .map((point, index) => {
      const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - (point.requests / max) * (height - 20) - 10;
      return `${index ? "L" : "M"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full rounded-md border border-surface-border bg-surface-muted"
        role="img"
        aria-labelledby="usage-chart-title usage-chart-description"
      >
        <title id="usage-chart-title">AI requests over time</title>
        <desc id="usage-chart-description">Request count for each UTC interval in the selected range.</desc>
        {points.length > 0 && <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="3" />}
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

function BreakdownChart({
  title,
  values,
}: {
  title: string;
  values: Array<{ key: string; label: string; requests: number }>;
}) {
  const max = Math.max(1, ...values.map((item) => item.requests));
  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 400 ${Math.max(50, values.length * 34)}`}
        className="w-full"
        role="img"
        aria-label={`${title} request breakdown`}
      >
        <title>{title} request breakdown</title>
        {values.map((item, index) => (
          <g key={item.key} transform={`translate(0 ${index * 34})`}>
            <text x="0" y="13" className="fill-text-secondary text-[11px]">{item.label}</text>
            <rect x="130" y="2" width={(item.requests / max) * 220} height="14" rx="3" fill="var(--color-accent)" />
            <text x="360" y="13" className="fill-text-primary text-[11px]">{item.requests}</text>
          </g>
        ))}
      </svg>
      <ul className="sr-only">{values.map((item) => <li key={item.key}>{item.label}: {item.requests} requests</li>)}</ul>
    </div>
  );
}

function UsagePanel() {
  const [range, setRange] = useState<UsageRange>("month");
  const { data, isLoading, error } = useAIUsage(range);
  if (isLoading) return <p className="text-sm text-text-muted">Loading deployment usage…</p>;
  if (error || !data) return <p role="alert" className="text-sm text-danger">Usage data is unavailable.</p>;
  const totals = data.totals;
  const cost =
    totals.cost_coverage === "local_only"
      ? "Local — no API cost"
      : totals.estimated_cost == null
        ? "Unavailable"
        : `${totals.estimated_cost.toFixed(4)} ${totals.cost_currency || ""}`.trim();
  return (
    <section aria-labelledby="usage-heading" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="usage-heading" className="text-lg font-semibold">Deployment usage</h2>
          <p className="text-sm text-text-secondary">All AI workloads · UTC</p>
        </div>
        <Select value={range} onValueChange={(value) => setRange(value as UsageRange)}>
          <SelectTrigger className="w-36" aria-label="Usage range"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Requests", totals.requests.toLocaleString()],
          ["Tokens", totals.input_tokens == null && totals.output_tokens == null ? "Unavailable" : `${(totals.input_tokens || 0).toLocaleString()} in · ${(totals.output_tokens || 0).toLocaleString()} out`],
          ["Processing time", totals.duration_ms == null ? "Unavailable" : `${(totals.duration_ms / 1000).toFixed(1)} s`],
          ["Estimated cost", cost],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-surface-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
            <p className="mt-2 text-xl font-semibold text-text-primary">{value}</p>
          </div>
        ))}
      </div>
      {totals.requests === 0 ? (
        <p className="rounded-md border border-dashed border-surface-border p-8 text-center text-text-muted">
          No usage data available for this range.
        </p>
      ) : (
        <UsageChart points={data.time_series} />
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {[
          ["Providers", data.by_provider],
          ["Workloads", data.by_workload],
        ].map(([title, values]) => (
          <section key={title as string}>
            <h3 className="mb-2 text-sm font-medium">{title as string}</h3>
            <BreakdownChart
              title={title as string}
              values={values as Array<{ key: string; label: string; requests: number }>}
            />
            <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
              {(values as Array<{ key: string; label: string; requests: number }>).map((item) => (
                <li key={item.key} className="flex justify-between p-3 text-sm">
                  <span>{item.label}</span><span>{item.requests.toLocaleString()} requests</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {totals.cost_coverage === "partial" && (
        <p className="text-xs text-warning">Cost coverage is partial; unknown remote costs are excluded.</p>
      )}
    </section>
  );
}

const ROLE_COPY: Record<AIWorkloadRole, [string, string]> = {
  indexing: ["Indexing Model", "Fast / lightweight instruct model recommended"],
  embedding: ["Embedding Model", "Dedicated embedding model recommended"],
  chat: ["Chat Model", "Reasoning-capable model recommended"],
  vision: ["Vision Model", "Legacy/experimental assignment"],
};

function AssignmentDialog({
  assignment,
  onClose,
}: {
  assignment: AIAssignment;
  onClose: () => void;
}) {
  const { data: providers = [] } = useAIProviders();
  const mutation = useUpdateAIAssignment();
  const [providerId, setProviderId] = useState(assignment.provider_id || "");
  const [model, setModel] = useState(assignment.model || "");
  const { data: discovery, isFetching } = useProviderModels(providerId || null);
  const compatible = providers.filter((provider) =>
    assignment.role === "embedding" ? provider.enabled && provider.supports_embeddings : provider.enabled,
  );
  const save = async () => {
    await mutation.mutateAsync({
      role: assignment.role,
      provider_id: providerId || null,
      model: providerId ? model.trim() || null : null,
    });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Change {ROLE_COPY[assignment.role][0]}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-secondary">Provider</label>
            <Select value={providerId || "none"} onValueChange={(value) => { setProviderId(value === "none" ? "" : value); setModel(""); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unconfigured</SelectItem>
                {compatible.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {providerId && (
            <div>
              <label htmlFor="assignment-model" className="text-xs text-text-secondary">Model ID</label>
              {discovery?.models.length ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>{discovery.models.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input id="assignment-model" className="mt-1" value={model} onChange={(event) => setModel(event.target.value)} placeholder={isFetching ? "Discovering models…" : "Enter provider model ID"} />
              )}
              {assignment.role === "embedding" && (
                <p className="mt-2 text-xs text-warning">Changing this assignment may require re-embedding existing documents.</p>
              )}
            </div>
          )}
          {mutation.error && <p role="alert" className="text-sm text-danger">{mutation.error.message}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={mutation.isPending || Boolean(providerId && !model.trim())}>Save assignment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModelsPanel() {
  const { data = [], isLoading, error } = useAIAssignments();
  const [editing, setEditing] = useState<AIAssignment | null>(null);
  const visible = useMemo(() => data.filter((item) => item.role !== "vision"), [data]);
  if (isLoading) return <p className="text-sm text-text-muted">Loading assignments…</p>;
  if (error) return <p role="alert" className="text-danger">Model assignments are unavailable.</p>;
  return (
    <section className="space-y-3" aria-labelledby="models-heading">
      <div><h2 id="models-heading" className="text-lg font-semibold">Workload models</h2><p className="text-sm text-text-secondary">Each workload routes independently. No fallback is configured.</p></div>
      {visible.map((assignment) => (
        <div key={assignment.role} className="flex flex-wrap items-center gap-4 border-b border-surface-border py-4">
          <div className="min-w-52 flex-1">
            <h3 className="font-medium">{ROLE_COPY[assignment.role][0]}</h3>
            <p className="text-xs text-text-muted">{ROLE_COPY[assignment.role][1]}</p>
          </div>
          <div className="min-w-48 text-sm">
            <p>{assignment.provider_name || "Not configured"} · {assignment.model || "No model"}</p>
            <p className="text-xs text-text-muted">
              {assignment.is_local == null ? "Unavailable" : assignment.is_local ? "Local" : "Cloud"} · {assignment.status}
              {assignment.embedding_dimension ? ` · ${assignment.embedding_dimension} dimensions` : ""}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setEditing(assignment)}>Change model</Button>
        </div>
      ))}
      {editing && <AssignmentDialog assignment={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function VisionAssignmentPanel() {
  const { data = [] } = useAIAssignments();
  const vision = data.find((item) => item.role === "vision");
  const [editing, setEditing] = useState(false);
  if (!vision) return null;
  return (
    <section className="border-t border-surface-border pt-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <h3 className="font-medium">Legacy vision assignment</h3>
          <p className="text-xs text-text-muted">{vision.provider_name || "Not configured"} · {vision.model || "No model"} · {vision.status}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Change vision model</Button>
      </div>
      {editing && <AssignmentDialog assignment={vision} onClose={() => setEditing(false)} />}
    </section>
  );
}

export function ArtificialIntelligencePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveTab(searchParams.get("tab"));
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Artificial Intelligence</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Deployment usage, models and providers, privacy policy, and performance.
        </p>
      </header>
      <Tabs value={tab} onValueChange={(value) => setSearchParams(value === "usage" ? {} : { tab: value })}>
        <TabsList className="max-w-full overflow-x-auto">
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value}>{TAB_LABELS[value]}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="usage"><UsagePanel /></TabsContent>
        <TabsContent value="models">
          <div className="space-y-10">
            <ModelsPanel />
            <section id="providers" className="scroll-mt-4 border-t border-surface-border pt-8" aria-label="Providers">
              <AIProvidersSettings />
            </section>
          </div>
        </TabsContent>
        <TabsContent value="advanced">
          <div className="space-y-10">
            <section id="ai-policy" className="scroll-mt-4" aria-label="Policy">
              <AIPolicySettings />
            </section>
            <section className="space-y-6 border-t border-surface-border pt-8" aria-label="Performance and experimental assignments">
              <AIProfilesSettings />
              <VisionAssignmentPanel />
              {dataVision()}
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function dataVision() {
  return <p className="text-xs text-text-muted">Vision remains a legacy/experimental assignment until a defined processing workflow is available.</p>;
}
