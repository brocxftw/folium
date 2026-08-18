import { describe, expect, it } from "vitest";
import { inboxAiFilingState } from "./inboxAiFiling";

describe("inboxAiFilingState", () => {
  it("shows AI suggestions when indexing is available and filing is on", () => {
    expect(
      inboxAiFilingState({
        auto_tagging: true,
        indexing: { status: "available" },
      }),
    ).toEqual({
      indexingReady: true,
      aiSuggestionsAvailable: true,
      reason: "ready",
    });
  });

  it("keeps manual filing when a model is assigned but Controls turned filing off", () => {
    expect(
      inboxAiFilingState({
        auto_tagging: false,
        indexing: { status: "available" },
      }),
    ).toEqual({
      indexingReady: true,
      aiSuggestionsAvailable: false,
      reason: "controls_off",
    });
  });

  it("asks the user to assign a filing model when indexing is not ready", () => {
    expect(
      inboxAiFilingState({
        auto_tagging: true,
        indexing: { status: "not_configured" },
      }),
    ).toEqual({
      indexingReady: false,
      aiSuggestionsAvailable: false,
      reason: "not_assigned",
    });
  });
});
