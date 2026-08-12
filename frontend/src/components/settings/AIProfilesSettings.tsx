import { useEffect, useState } from "react";
import { useAIPolicy, useUpdateAIPolicy } from "@/lib/api/hooks";
import type { AIProfile } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";

const PROFILES = [
  {
    id: "lightweight",
    name: "Lightweight",
    description: "Minimal context and output for fast responses.",
    details: ["3 retrieved chunks", "8k context", "1k output"],
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Good balance of quality and performance for most deployments.",
    details: ["8 retrieved chunks", "16k context", "2k output"],
  },
  {
    id: "quality",
    name: "Quality",
    description: "Best results with larger models and more retrieved context.",
    details: ["16 retrieved chunks", "32k context", "4k output"],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Fine-grained response and concurrency limits.",
    details: ["Custom retrieval", "Custom token limits"],
  },
];

export function AIProfilesSettings() {
  const { data: policy } = useAIPolicy();
  const update = useUpdateAIPolicy();
  const [profile, setProfile] = useState<AIProfile>("lightweight");
  const [limits, setLimits] = useState({
    retrieved_chunks: 3,
    max_context_tokens: 8000,
    max_output_tokens: 1024,
    conversation_history_tokens: 2000,
    parallel_llm_calls: 1,
  });
  useEffect(() => {
    if (!policy) return;
    setProfile(policy.profile);
    setLimits({
      retrieved_chunks: policy.retrieved_chunks,
      max_context_tokens: policy.max_context_tokens,
      max_output_tokens: policy.max_output_tokens,
      conversation_history_tokens: policy.conversation_history_tokens,
      parallel_llm_calls: policy.parallel_llm_calls,
    });
  }, [policy]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Response performance</h2>
        <p className="text-sm text-text-secondary mt-1">
          Context, retrieval, output, and parallelism presets. These do not choose models.
        </p>
        {policy && (
          <p className="text-xs text-accent mt-2">
            Active profile: <strong className="capitalize">{policy.profile}</strong>
          </p>
        )}
      </div>

      <div className="max-w-xs">
        <label className="text-xs text-text-muted">Active response profile</label>
        <Select value={profile} onValueChange={(value) => setProfile(value as AIProfile)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROFILES.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
          </SelectContent>
        </Select>
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

      {profile === "custom" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(limits).map(([key, value]) => (
            <label key={key} className="text-xs text-text-muted">
              {key.replaceAll("_", " ")}
              <Input
                type="number"
                min={1}
                className="mt-1"
                value={value}
                onChange={(event) => setLimits({ ...limits, [key]: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>
      )}
      <Button
        onClick={() => update.mutate(profile === "custom" ? { profile, ...limits } : { profile })}
        disabled={update.isPending}
      >
        Save response performance
      </Button>
    </div>
  );
}
