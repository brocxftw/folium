import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ArtificialIntelligencePage } from "@/features/settings/ArtificialIntelligencePage";

const { idleMutation, policy } = vi.hoisted(() => ({
  idleMutation: {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  },
  policy: {
    privacy_mode: "local_only",
    profile: "balanced",
    chat_provider_id: null,
    embedding_provider_id: null,
    vision_provider_id: null,
    allow_remote_embeddings: false,
    allow_remote_qa: false,
    allow_remote_vision: false,
    warn_before_remote: true,
    block_remote_ai: true,
    auto_enrichment: false,
    auto_tagging: false,
    retrieved_chunks: 8,
    max_context_tokens: 16000,
    max_output_tokens: 3000,
    conversation_history_tokens: 2000,
    parallel_llm_calls: 1,
    semantic_min_score: null,
    active_embedding_provider: null,
    active_embedding_model: null,
    active_embedding_dimension: null,
    enforcement_note: "Local-only mode is active.",
  },
}));

vi.mock("@/lib/api/hooks", () => ({
  useAIUsage: () => ({ data: null, isLoading: true, error: null }),
  useAIAssignments: () => ({ data: [], isLoading: false, error: null }),
  useAIProviders: () => ({ data: [], isLoading: false }),
  useProviderModels: () => ({ data: { models: [] }, isFetching: false }),
  useUpdateAIAssignment: () => idleMutation,
  useCreateAIProvider: () => idleMutation,
  useUpdateAIProvider: () => idleMutation,
  useDeleteAIProvider: () => idleMutation,
  useTestAIProvider: () => idleMutation,
  useAIPolicy: () => ({ data: policy, isLoading: false }),
  useUpdateAIPolicy: () => idleMutation,
}));

function renderPage(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/settings/artificial-intelligence${search}`]}>
      <ArtificialIntelligencePage />
    </MemoryRouter>,
  );
}

describe("Artificial Intelligence settings tabs", () => {
  it("shows Usage, Models, and Advanced as the only tabs", () => {
    renderPage();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Usage",
      "Models",
      "Advanced",
    ]);
  });

  it("places workload models and providers in separate Models sections", () => {
    renderPage("?tab=models");
    expect(screen.getByRole("tab", { name: "Models" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("heading", { name: "Workload models" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI Providers" })).toBeInTheDocument();
    expect(document.getElementById("providers")).toBeTruthy();
  });

  it("places policy and response performance in separate Advanced sections", () => {
    renderPage("?tab=advanced");
    expect(screen.getByRole("tab", { name: "Advanced" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("heading", { name: "AI Policy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Response performance" })).toBeInTheDocument();
    expect(document.getElementById("ai-policy")).toBeTruthy();
  });

  it("maps the legacy providers tab onto Models", () => {
    renderPage("?tab=providers");
    expect(screen.getByRole("tab", { name: "Models" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("heading", { name: "AI Providers" })).toBeInTheDocument();
  });

  it("maps the legacy policy tab onto Advanced", () => {
    renderPage("?tab=policy");
    expect(screen.getByRole("tab", { name: "Advanced" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("heading", { name: "AI Policy" })).toBeInTheDocument();
  });
});
