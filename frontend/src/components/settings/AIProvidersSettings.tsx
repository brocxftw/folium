import { useState } from "react";
import { Plus, Trash2, Zap, Eye, EyeOff } from "lucide-react";
import {
  useAIProviders,
  useCreateAIProvider,
  useUpdateAIProvider,
  useDeleteAIProvider,
  useTestAIProvider,
} from "@/lib/api/hooks";
import type { AIProvider, AIProviderCreate, AIProviderKind } from "@/lib/api/types";
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
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";

const PROVIDER_KINDS: { value: AIProviderKind; label: string; defaultUrl: string; local: boolean }[] = [
  { value: "ollama", label: "Ollama (local)", defaultUrl: "http://host.docker.internal:11434/v1", local: true },
  { value: "openai_compatible", label: "OpenAI Compatible", defaultUrl: "https://api.openai.com/v1", local: false },
  { value: "openai", label: "OpenAI", defaultUrl: "https://api.openai.com/v1", local: false },
  { value: "openrouter", label: "OpenRouter", defaultUrl: "https://openrouter.ai/api/v1", local: false },
  { value: "anthropic", label: "Anthropic", defaultUrl: "https://api.anthropic.com", local: false },
  { value: "gemini", label: "Google Gemini", defaultUrl: "https://generativelanguage.googleapis.com/v1beta", local: false },
];

const DEFAULT_FORM: AIProviderCreate = {
  name: "",
  kind: "openai_compatible",
  base_url: "https://api.openai.com/v1",
  is_local: false,
  chat_model: "",
  embedding_model: "",
};

function ProviderRow({
  provider,
  onEdit,
  onDelete,
  onTest,
  testing,
}: {
  provider: AIProvider;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  testing: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-surface-border p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary">{provider.name}</span>
          <span className="text-xs text-text-muted capitalize">{provider.kind.replace("_", " ")}</span>
          {provider.is_local && (
            <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] text-accent">local</span>
          )}
          {!provider.enabled && (
            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-muted">disabled</span>
          )}
        </div>
        <p className="text-xs text-text-muted font-mono truncate mt-0.5">{provider.base_url}</p>
        <div className="flex gap-3 mt-1 text-xs text-text-secondary">
          {provider.chat_model && <span>Chat: {provider.chat_model}</span>}
          {provider.embedding_model && <span>Embed: {provider.embedding_model}</span>}
          {provider.has_api_key && (
            <span>Key: {provider.api_key_masked ?? "••••••••"}</span>
          )}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onTest} disabled={testing}>
        <Zap className="h-3.5 w-3.5 mr-1" />
        Test
      </Button>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5 text-danger" />
      </Button>
    </div>
  );
}

export function AIProvidersSettings() {
  const { data: providers = [], isLoading } = useAIProviders();
  const createProvider = useCreateAIProvider();
  const updateProvider = useUpdateAIProvider();
  const deleteProvider = useDeleteAIProvider();
  const testProvider = useTestAIProvider();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AIProvider | null>(null);
  const [form, setForm] = useState<AIProviderCreate>(DEFAULT_FORM);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setApiKey("");
    setSaveError(null);
    setDialogOpen(true);
  };

  const openEdit = (p: AIProvider) => {
    setEditing(p);
    setForm({
      name: p.name,
      kind: p.kind as AIProviderKind,
      base_url: p.base_url,
      is_local: p.is_local,
      chat_model: p.chat_model ?? "",
      embedding_model: p.embedding_model ?? "",
      vision_model: p.vision_model ?? "",
      supports_embeddings: p.supports_embeddings,
    });
    setApiKey("");
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaveError(null);
    const payload = {
      ...form,
      chat_model: form.chat_model || undefined,
      embedding_model: form.embedding_model || undefined,
      api_key: apiKey || undefined,
      supports_embeddings: Boolean(form.embedding_model),
    };

    try {
      if (editing) {
        await updateProvider.mutateAsync({
          id: editing.id,
          data: {
            ...payload,
            clear_api_key: !apiKey && editing.has_api_key ? false : undefined,
          },
        });
      } else {
        await createProvider.mutateAsync(payload);
      }
      setDialogOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save provider");
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await testProvider.mutateAsync(id);
      setTestResult({ id, ok: true, message: result.message || "Connection successful" });
    } catch (err) {
      setTestResult({
        id,
        ok: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">AI Providers</h2>
          <p className="text-sm text-text-secondary mt-1">
            Configure LLM and embedding providers
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Add provider
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : providers.length === 0 ? (
        <p className="text-sm text-text-muted">
          No providers configured. Add a local Ollama instance or a remote API provider.
        </p>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.id}>
              <ProviderRow
                provider={p}
                onEdit={() => openEdit(p)}
                onDelete={() => deleteProvider.mutate(p.id)}
                onTest={() => handleTest(p.id)}
                testing={testProvider.isPending}
              />
              {testResult?.id === p.id && (
                <p
                  className={cn(
                    "text-xs mt-1 px-3",
                    testResult.ok ? "text-accent" : "text-danger",
                  )}
                >
                  {testResult.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit provider" : "Add provider"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-muted">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Kind</label>
              <Select
                value={form.kind}
                onValueChange={(v) => {
                  const kind = v as AIProviderKind;
                  const preset = PROVIDER_KINDS.find((k) => k.value === kind);
                  setForm({
                    ...form,
                    kind,
                    is_local: preset?.local ?? false,
                    base_url: preset?.defaultUrl ?? form.base_url,
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-text-muted">Base URL</label>
              <Input
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">
                API Key {editing?.has_api_key && "(leave blank to keep existing)"}
              </label>
              <div className="relative mt-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={editing?.api_key_masked ?? "Optional for local providers"}
                  className="pr-8 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-text-muted">Chat model</label>
              <Input
                value={form.chat_model ?? ""}
                onChange={(e) => setForm({ ...form, chat_model: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Embedding model</label>
              <Input
                value={form.embedding_model ?? ""}
                onChange={(e) => setForm({ ...form, embedding_model: e.target.value })}
                className="mt-1"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.is_local}
                onCheckedChange={(c) => setForm({ ...form, is_local: !!c })}
              />
              Local provider
            </label>
          </div>
          {saveError && <p className="text-sm text-danger mt-2">{saveError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name || !form.base_url || createProvider.isPending || updateProvider.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
