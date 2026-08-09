import { useAIPolicy } from "@/lib/api/hooks";

const PROFILES = [
  {
    id: "lightweight",
    name: "Lightweight",
    description: "Minimal resource usage. Local models only, smaller context windows.",
    details: ["Fast processing", "Low memory", "Basic summaries"],
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Good balance of quality and performance for most deployments.",
    details: ["Hybrid search", "Standard summaries", "Moderate context"],
  },
  {
    id: "quality",
    name: "Quality",
    description: "Best results with larger models and more retrieved context.",
    details: ["Deep analysis", "Large context", "Rich metadata suggestions"],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Fine-grained control via AI Policy settings.",
    details: ["Manual provider selection", "Custom token limits"],
  },
];

export function AIProfilesSettings() {
  const { data: policy } = useAIPolicy();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary">AI Profiles</h2>
        <p className="text-sm text-text-secondary mt-1">
          Preset configurations for AI behavior
        </p>
        {policy && (
          <p className="text-xs text-accent mt-2">
            Active profile: <strong className="capitalize">{policy.profile}</strong>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PROFILES.map((profile) => (
          <div
            key={profile.id}
            className={`rounded-md border p-4 ${
              policy?.profile === profile.id
                ? "border-accent bg-accent-muted/20"
                : "border-surface-border"
            }`}
          >
            <h3 className="font-medium text-text-primary">{profile.name}</h3>
            <p className="text-sm text-text-secondary mt-1">{profile.description}</p>
            <ul className="mt-3 space-y-1">
              {profile.details.map((d) => (
                <li key={d} className="text-xs text-text-muted flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-text-muted" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-muted">
        Change the active profile in AI Policy settings.
      </p>
    </div>
  );
}
