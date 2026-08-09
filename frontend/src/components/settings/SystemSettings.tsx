import { useHealth, useAIUsage } from "@/lib/api/hooks";

export function SystemSettings() {
  const { data: health } = useHealth();
  const { data: usage, isLoading: usageLoading } = useAIUsage();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary">System</h2>
        <p className="text-sm text-text-secondary mt-1">
          Application status and usage
        </p>
      </div>

      <div className="rounded-md border border-surface-border p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">Health</h3>
        <dl className="space-y-2 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-text-secondary">Status</dt>
            <dd className="text-text-primary capitalize">{health?.status ?? "Unknown"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Version</dt>
            <dd className="text-text-primary font-mono">{health?.version ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-md border border-surface-border p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">AI Usage</h3>
        {usageLoading ? (
          <p className="text-sm text-text-muted">Loading usage…</p>
        ) : !usage ? (
          <p className="text-sm text-text-muted">Usage data unavailable</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-medium text-text-muted uppercase mb-2">Today</h4>
              <pre className="text-xs text-text-secondary bg-surface-muted rounded p-2 overflow-auto">
                {JSON.stringify(usage.today, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-xs font-medium text-text-muted uppercase mb-2">This month</h4>
              <pre className="text-xs text-text-secondary bg-surface-muted rounded p-2 overflow-auto">
                {JSON.stringify(usage.this_month, null, 2)}
              </pre>
            </div>
            {usage.by_provider.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-text-muted uppercase mb-2">By provider</h4>
                <pre className="text-xs text-text-secondary bg-surface-muted rounded p-2 overflow-auto max-h-40">
                  {JSON.stringify(usage.by_provider, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
