import { useEffect, useState } from "react";
import { useAIPolicy, useUpdateAIPolicy, useAIProviders } from "@/lib/api/hooks";
import type { AIPolicyUpdate, PrivacyMode, AIProfile } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";

export function AIPolicySettings() {
  const { data: policy, isLoading } = useAIPolicy();
  const { data: providers = [] } = useAIProviders();
  const updatePolicy = useUpdateAIPolicy();
  const [form, setForm] = useState<AIPolicyUpdate>({});

  useEffect(() => {
    if (policy) {
      setForm({
        privacy_mode: policy.privacy_mode as PrivacyMode,
        profile: policy.profile as AIProfile,
        chat_provider_id: policy.chat_provider_id,
        embedding_provider_id: policy.embedding_provider_id,
        vision_provider_id: policy.vision_provider_id,
        allow_remote_embeddings: policy.allow_remote_embeddings,
        allow_remote_qa: policy.allow_remote_qa,
        allow_remote_vision: policy.allow_remote_vision,
        warn_before_remote: policy.warn_before_remote,
        block_remote_ai: policy.block_remote_ai,
        auto_enrichment: policy.auto_enrichment,
        auto_tagging: policy.auto_tagging,
        retrieved_chunks: policy.retrieved_chunks,
        max_context_tokens: policy.max_context_tokens,
        max_output_tokens: policy.max_output_tokens,
      });
    }
  }, [policy]);

  const save = () => updatePolicy.mutate(form);

  if (isLoading || !policy) {
    return <p className="text-sm text-text-muted">Loading policy…</p>;
  }

  const chatProviders = providers.filter((p) => p.enabled);
  const embedProviders = providers.filter((p) => p.enabled && p.supports_embeddings);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary">AI Policy</h2>
        <p className="text-sm text-text-secondary mt-1">
          Privacy controls and default AI behavior
        </p>
      </div>

      <div className="rounded-md border border-surface-border bg-surface-muted p-3 text-xs text-text-secondary">
        {policy.enforcement_note}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs text-text-muted">Privacy mode</label>
          <Select
            value={form.privacy_mode}
            onValueChange={(v) => setForm({ ...form, privacy_mode: v as PrivacyMode })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local_only">Local only</SelectItem>
              <SelectItem value="private_hybrid">Private hybrid</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-text-muted">Profile</label>
          <Select
            value={form.profile}
            onValueChange={(v) => setForm({ ...form, profile: v as AIProfile })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lightweight">Lightweight</SelectItem>
              <SelectItem value="balanced">Balanced</SelectItem>
              <SelectItem value="quality">Quality</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-text-muted">Chat provider</label>
          <Select
            value={form.chat_provider_id ?? "none"}
            onValueChange={(v) =>
              setForm({ ...form, chat_provider_id: v === "none" ? null : v })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {chatProviders.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-text-muted">Embedding provider</label>
          <Select
            value={form.embedding_provider_id ?? "none"}
            onValueChange={(v) =>
              setForm({ ...form, embedding_provider_id: v === "none" ? null : v })
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {embedProviders.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-primary">Remote access</h3>
        {(
          [
            ["allow_remote_qa", "Allow remote Q&A"],
            ["allow_remote_embeddings", "Allow remote embeddings"],
            ["allow_remote_vision", "Allow remote vision"],
            ["warn_before_remote", "Warn before remote calls"],
            ["block_remote_ai", "Block all remote AI"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={!!form[key]}
              onCheckedChange={(c) => setForm({ ...form, [key]: !!c })}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-primary">Automation</h3>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!form.auto_enrichment}
            onCheckedChange={(c) => setForm({ ...form, auto_enrichment: !!c })}
          />
          Auto-enrichment (summaries)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!form.auto_tagging}
            onCheckedChange={(c) => setForm({ ...form, auto_tagging: !!c })}
          />
          Auto-tagging suggestions
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-xs text-text-muted">Retrieved chunks</label>
          <Input
            type="number"
            value={form.retrieved_chunks ?? ""}
            onChange={(e) =>
              setForm({ ...form, retrieved_chunks: parseInt(e.target.value) || 0 })
            }
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted">Max context tokens</label>
          <Input
            type="number"
            value={form.max_context_tokens ?? ""}
            onChange={(e) =>
              setForm({ ...form, max_context_tokens: parseInt(e.target.value) || 0 })
            }
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted">Max output tokens</label>
          <Input
            type="number"
            value={form.max_output_tokens ?? ""}
            onChange={(e) =>
              setForm({ ...form, max_output_tokens: parseInt(e.target.value) || 0 })
            }
            className="mt-1"
          />
        </div>
      </div>

      {policy.active_embedding_provider && (
        <p className="text-xs text-text-muted">
          Active embedding: {policy.active_embedding_provider} / {policy.active_embedding_model}
          {policy.active_embedding_dimension && ` (${policy.active_embedding_dimension}d)`}
        </p>
      )}

      <Button onClick={save} disabled={updatePolicy.isPending}>
        {updatePolicy.isPending ? "Saving…" : "Save policy"}
      </Button>
    </div>
  );
}
