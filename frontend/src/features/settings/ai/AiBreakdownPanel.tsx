import { workloadDisplayLabel } from "./workloadCopy";

export function AiBreakdownPanel({
  title,
  values,
  totalRequests,
}: {
  title: string;
  values: Array<{ key: string; label: string; requests: number }>;
  totalRequests: number;
}) {
  const max = Math.max(1, ...values.map((item) => item.requests));
  const total = totalRequests || values.reduce((sum, item) => sum + item.requests, 0);

  return (
    <div className="rounded-lg border border-surface-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {values.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">No requests in this period.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {values.map((item) => {
            const pct = total > 0 ? Math.round((item.requests / total) * 100) : 0;
            const displayLabel = workloadDisplayLabel(item.key, item.label);
            return (
              <li key={item.key}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-text-primary">{displayLabel}</span>
                  <span className="shrink-0 tabular-nums text-text-secondary">
                    {item.requests.toLocaleString()} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${(item.requests / max) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 border-t border-surface-border pt-3 text-xs text-text-muted">
        Total requests: {total.toLocaleString()}
      </p>
    </div>
  );
}
