export type InboxAiFilingState = {
  indexingReady: boolean;
  aiSuggestionsAvailable: boolean;
  reason: "ready" | "controls_off" | "not_assigned";
};

export function inboxAiFilingState(health: {
  auto_tagging?: boolean;
  indexing?: { status?: string | null };
} | null | undefined): InboxAiFilingState {
  const indexingReady = health?.indexing?.status === "available";
  const autoTagging = Boolean(health?.auto_tagging);
  if (indexingReady && autoTagging) {
    return {
      indexingReady: true,
      aiSuggestionsAvailable: true,
      reason: "ready",
    };
  }
  if (indexingReady) {
    return {
      indexingReady: true,
      aiSuggestionsAvailable: false,
      reason: "controls_off",
    };
  }
  return {
    indexingReady: false,
    aiSuggestionsAvailable: false,
    reason: "not_assigned",
  };
}
