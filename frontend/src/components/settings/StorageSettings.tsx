import { useStorageHealth } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, HardDrive } from "lucide-react";

export function StorageSettings() {
  const { data: health, isLoading, error } = useStorageHealth();

  if (isLoading) {
    return <p className="text-sm text-text-muted">Checking storage…</p>;
  }

  if (error || !health) {
    return (
      <p className="text-sm text-danger">Unable to retrieve storage health.</p>
    );
  }

  const paths = [
    { label: "Documents", path: health.documents_path, ok: health.documents_ok },
    { label: "Consume", path: health.consume_path, ok: health.consume_ok },
    { label: "Export", path: health.export_path, ok: health.export_ok },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Storage</h2>
        <p className="text-sm text-text-secondary mt-1">
          Filesystem paths and health status
        </p>
      </div>

      <div
        className={cn(
          "rounded-md border p-4",
          health.status === "ok"
            ? "border-accent/30 bg-accent-muted/30"
            : "border-warning/30 bg-amber-50",
        )}
      >
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-text-muted" />
          <span className="font-medium capitalize">{health.status}</span>
        </div>
        {health.message && (
          <p className="text-sm text-text-secondary mt-1">{health.message}</p>
        )}
      </div>

      <div className="space-y-3">
        {paths.map(({ label, path, ok }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-md border border-surface-border p-3"
          >
            {ok ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
            )}
            <div>
              <p className="text-[13px] font-medium text-text-primary">{label}</p>
              <p className="text-xs text-text-muted font-mono mt-0.5">{path}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
