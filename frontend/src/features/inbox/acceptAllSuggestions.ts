import type { Suggestion } from "@/lib/api/types";
import { api } from "@/lib/api/client";

/** Accept pending suggestions for the given document ids via existing accept API. */
export async function acceptAllSuggestions(
  pending: Suggestion[],
  documentIds: string[],
): Promise<{ accepted: number; failed: number }> {
  const idSet = new Set(documentIds);
  const targets = pending.filter((s) => idSet.has(s.document_id));
  // Group by document to keep field apply order stable within a doc.
  const byDoc = new Map<string, Suggestion[]>();
  for (const s of targets) {
    (byDoc.get(s.document_id) ?? byDoc.set(s.document_id, []).get(s.document_id)!).push(s);
  }

  let accepted = 0;
  let failed = 0;
  for (const rows of byDoc.values()) {
    for (const s of rows) {
      try {
        await api.post(`/api/ai/suggestions/${s.id}/accept`);
        accepted += 1;
      } catch {
        failed += 1;
      }
    }
  }
  return { accepted, failed };
}
