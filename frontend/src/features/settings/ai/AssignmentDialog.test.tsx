import { describe, expect, it } from "vitest";
import { assignmentProviderChoices } from "./AssignmentDialog";

describe("assignmentProviderChoices", () => {
  it("lists enabled providers even when they do not advertise embeddings", () => {
    const providers = [
      { id: "p1", enabled: true, supports_embeddings: false },
      { id: "p2", enabled: false, supports_embeddings: true },
    ];
    expect(assignmentProviderChoices(providers).map((item) => item.id)).toEqual(["p1"]);
  });
});
