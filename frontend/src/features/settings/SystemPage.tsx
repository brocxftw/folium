import { useState } from "react";
import {
  useDiagnostics,
  useStorageMetrics,
  useSystemSummary,
} from "@/lib/api/hooks";
import { Button } from "@/components/ui/Button";
import { formatBytes } from "@/lib/utils";

function Status({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-surface-muted px-2 py-0.5 text-xs capitalize text-text-secondary">
      {value}
    </span>
  );
}

function StorageDonut({
  used,
  total,
  free,
}: {
  used: number | null;
  total: number | null;
  free: number | null;
}) {
  const ratio = used != null && total ? Math.min(1, used / total) : 0;
  const circumference = 2 * Math.PI * 44;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-36 w-36" role="img" aria-labelledby="disk-title disk-desc">
        <title id="disk-title">Document library filesystem capacity</title>
        <desc id="disk-desc">
          {used == null || total == null ? "Capacity unavailable" : `${formatBytes(used)} used of ${formatBytes(total)}`}
        </desc>
        <circle cx="60" cy="60" r="44" fill="none" stroke="var(--color-surface-border)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r="44"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="12"
          strokeDasharray={`${ratio * circumference} ${circumference}`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="57" textAnchor="middle" className="fill-text-primary text-[12px] font-semibold">
          {free == null ? "—" : formatBytes(free)}
        </text>
        <text x="60" y="73" textAnchor="middle" className="fill-text-muted text-[8px]">free</text>
      </svg>
      <div className="text-sm text-text-secondary">
        <p><strong className="text-text-primary">{used == null ? "Unavailable" : formatBytes(used)}</strong> disk used</p>
        <p>{total == null ? "Unavailable" : formatBytes(total)} filesystem total</p>
        <p>{free == null ? "Unavailable" : formatBytes(free)} free</p>
      </div>
    </div>
  );
}

export function SystemPage() {
  const { data, isLoading, error } = useSystemSummary();
  const { data: storage } = useStorageMetrics();
  const diagnostics = useDiagnostics();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const copyDiagnostics = async () => {
    const result = await diagnostics.mutateAsync();
    await navigator.clipboard.writeText(result.text);
    setCopyMessage("Diagnostics copied");
  };
  if (isLoading) return <p className="p-6 text-text-muted">Loading system status…</p>;
  if (error || !data) return <p role="alert" className="p-6 text-danger">System status is unavailable.</p>;
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-semibold">System</h1><p className="mt-1 text-sm text-text-secondary">Truthful application and container-visible operational details.</p></div>
        <div className="text-right">
          <Button variant="secondary" onClick={() => void copyDiagnostics()} disabled={diagnostics.isPending}>Copy diagnostics</Button>
          {copyMessage && <p aria-live="polite" className="mt-1 text-xs text-accent">{copyMessage}</p>}
        </div>
      </header>

      <section id="application" aria-labelledby="application-heading" className="space-y-4">
        <h2 id="application-heading" className="text-lg font-semibold">Application</h2>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Folium version", data.version],
            ["Schema revision", data.schema_revision],
            ["Process uptime", `${Math.floor(data.process_uptime_seconds / 60)} minutes`],
            ["Database", data.database_status],
            ["Storage", data.storage_status],
            ["Worker heartbeat", data.worker_status],
            ["Documents", data.document_count.toLocaleString()],
            ["Indexed documents", data.indexed_document_count.toLocaleString()],
            ["Jobs", `${data.queued_jobs} queued · ${data.running_jobs} running`],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-surface-border pb-3">
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="mt-1 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="runtime" aria-labelledby="runtime-heading" className="space-y-4">
        <div><h2 id="runtime-heading" className="text-lg font-semibold">Runtime</h2><p className="text-sm text-text-secondary">{data.deployment_mode}. Docker Engine and Compose status are unavailable without host integration.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.services).map(([service, status]) => (
            <div key={service} className="flex items-center justify-between rounded-md border border-surface-border p-3">
              <span className="font-medium capitalize">{service}</span><Status value={status} />
            </div>
          ))}
        </div>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {Object.entries(data.runtime).map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs capitalize text-text-muted">{label.replaceAll("_", " ")}</dt>
              <dd className="mt-1">{value ?? "Unavailable"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="storage" aria-labelledby="storage-heading" className="space-y-5">
        <div><h2 id="storage-heading" className="text-lg font-semibold">Storage</h2><p className="text-sm text-text-secondary">{storage?.message}</p></div>
        <div className="grid gap-8 lg:grid-cols-2">
          <StorageDonut used={storage?.disk_used_bytes ?? null} total={storage?.disk_total_bytes ?? null} free={storage?.disk_free_bytes ?? null} />
          <dl className="space-y-3">
            <div><dt className="text-xs text-text-muted">Configured source</dt><dd>{storage?.configured_source || "Unavailable"}</dd></div>
            <div className="flex items-center gap-2">
              <div><dt className="text-xs text-text-muted">Container mount</dt><dd className="font-mono text-xs">{storage?.container_path || "Unavailable"}</dd></div>
              {storage?.container_path && <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(storage.container_path)}>Copy path</Button>}
            </div>
            <div><dt className="text-xs text-text-muted">Folium-owned files</dt><dd>{storage?.folium_bytes == null ? "Unavailable" : formatBytes(storage.folium_bytes)}</dd></div>
            <div><dt className="text-xs text-text-muted">Database logical size</dt><dd>{storage?.database_bytes == null ? "Unavailable" : formatBytes(storage.database_bytes)}</dd></div>
          </dl>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(storage?.categories || {}).map(([category, bytes]) => (
            <li key={category} className="rounded-md bg-surface-muted p-3 text-sm capitalize">
              {category}<strong className="block">{bytes == null ? "Unavailable" : formatBytes(bytes)}</strong>
            </li>
          ))}
        </ul>
        {Object.keys(storage?.database_categories || {}).length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Database relations (separate filesystem)</h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(storage?.database_categories || {}).map(([category, bytes]) => (
                <li key={category} className="rounded-md bg-surface-muted p-3 text-sm">
                  {category.replaceAll("_", " ")}
                  <strong className="block">{bytes == null ? "Unavailable" : formatBytes(bytes)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
