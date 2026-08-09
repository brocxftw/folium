import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApplicationLogs, useClearApplicationLogs } from "@/lib/api/hooks";
import type { ApplicationLog } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/Sheet";

export function LogsPage() {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<ApplicationLog | null>(null);
  const [live, setLive] = useState(false);
  const filters = {
    search: params.get("search") || undefined,
    level: params.get("level") || undefined,
    service: params.get("service") || undefined,
    range: params.get("range") || "24h",
    page: Number(params.get("page") || 1),
  };
  const { data, isLoading, error, refetch } = useApplicationLogs(filters, live);
  const clear = useClearApplicationLogs();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  const exportUrl = `/api/logs/export?${new URLSearchParams(
    Object.entries(filters)
      .filter(([key, value]) => key !== "page" && value)
      .map(([key, value]) => [key, String(value)]),
  )}`;
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-semibold">Logs</h1><p className="mt-1 text-sm text-text-secondary">Redacted Folium API and worker application events. Database outage events remain stdout-only.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void refetch()}>Refresh</Button>
          <Button variant="secondary" onClick={() => { window.location.href = exportUrl; }}>Export CSV</Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm("Clear all persisted Folium application logs? This cannot be undone.")) clear.mutate();
            }}
            disabled={clear.isPending}
          >
            Clear
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-surface-border bg-surface p-3">
        <label className="min-w-56 flex-1 text-xs text-text-muted">Search
          <Input className="mt-1" value={filters.search || ""} onChange={(event) => update("search", event.target.value)} placeholder="Message, module, or request ID" />
        </label>
        <label className="text-xs text-text-muted">Level
          <Select value={filters.level || "all"} onValueChange={(value) => update("level", value === "all" ? "" : value)}>
            <SelectTrigger className="mt-1 w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All levels</SelectItem>{["INFO", "WARNING", "ERROR", "CRITICAL"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="text-xs text-text-muted">Service
          <Select value={filters.service || "all"} onValueChange={(value) => update("service", value === "all" ? "" : value)}>
            <SelectTrigger className="mt-1 w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All services</SelectItem><SelectItem value="api">API</SelectItem><SelectItem value="worker">Worker</SelectItem></SelectContent>
          </Select>
        </label>
        <label className="text-xs text-text-muted">Range
          <Select value={filters.range} onValueChange={(value) => update("range", value)}>
            <SelectTrigger className="mt-1 w-28"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1h">1 hour</SelectItem><SelectItem value="24h">24 hours</SelectItem><SelectItem value="7d">7 days</SelectItem><SelectItem value="30d">30 days</SelectItem></SelectContent>
          </Select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm"><Checkbox checked={live} onCheckedChange={(value) => setLive(Boolean(value))} />Live polling</label>
      </div>
      {isLoading ? (
        <p className="text-text-muted">Loading events…</p>
      ) : error ? (
        <p role="alert" className="text-danger">The log store is unavailable. Live polling has not been enabled automatically.</p>
      ) : !data?.items.length ? (
        <p className="rounded-md border border-dashed border-surface-border p-10 text-center text-text-muted">
          {Object.values(filters).some(Boolean) ? "No events match these filters." : "No application events have been persisted yet."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-surface-border bg-surface">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface-muted text-xs text-text-muted"><tr><th className="p-3">Timestamp</th><th className="p-3">Level</th><th className="p-3">Service</th><th className="p-3">Module</th><th className="p-3">Message</th></tr></thead>
              <tbody className="divide-y divide-surface-border">
                {data.items.map((item) => (
                  <tr key={item.id} className="cursor-pointer hover:bg-surface-hover" tabIndex={0} onClick={() => setSelected(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(item); }}>
                    <td className="whitespace-nowrap p-3 text-xs">{new Date(item.timestamp).toLocaleString()}</td>
                    <td className="p-3 font-medium">{item.level}</td><td className="p-3">{item.service}</td><td className="max-w-48 truncate p-3">{item.module}</td><td className="max-w-xl truncate p-3">{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>{data.total.toLocaleString()} events · {data.retention_days}-day retention</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={filters.page <= 1} onClick={() => update("page", String(filters.page - 1))}>Previous</Button>
              <Button size="sm" variant="ghost" disabled={filters.page * data.page_size >= data.total} onClick={() => update("page", String(filters.page + 1))}>Next</Button>
            </div>
          </div>
        </>
      )}
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>Log event</SheetTitle><SheetDescription>Sanitized structured application context</SheetDescription></SheetHeader>
          {selected && <div className="space-y-4 overflow-auto p-4 text-sm">
            <dl className="space-y-2">{Object.entries({ Timestamp: new Date(selected.timestamp).toLocaleString(), Level: selected.level, Service: selected.service, Module: selected.module, "Request ID": selected.request_id || "Unavailable" }).map(([key, value]) => <div key={key}><dt className="text-xs text-text-muted">{key}</dt><dd className="break-words">{value}</dd></div>)}</dl>
            <section><h3 className="text-xs font-medium text-text-muted">Message</h3><p className="mt-1 whitespace-pre-wrap">{selected.message}</p></section>
            {Object.keys(selected.context).length > 0 && <section><h3 className="text-xs font-medium text-text-muted">Context</h3><pre className="mt-1 overflow-auto rounded bg-surface-muted p-3 text-xs">{JSON.stringify(selected.context, null, 2)}</pre></section>}
            {selected.stack_trace && <section><h3 className="text-xs font-medium text-text-muted">Stack trace</h3><pre className="mt-1 overflow-auto whitespace-pre-wrap rounded bg-surface-muted p-3 text-xs">{selected.stack_trace}</pre></section>}
          </div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
