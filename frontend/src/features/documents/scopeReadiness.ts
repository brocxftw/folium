import type { Document } from "@/lib/api/types";
import {
  canAskDocument,
  getRetrievalReadiness,
} from "@/features/documents/retrievalReadiness";

export interface ScopeReadinessSummary {
  total: number;
  askReady: number;
  keywordReady: number;
  semanticReady: number;
  unavailable: number;
  label: string;
}

export function summarizeScopeReadiness(
  documents: Document[],
  label: string,
): ScopeReadinessSummary {
  let askReady = 0;
  let keywordReady = 0;
  let semanticReady = 0;
  let unavailable = 0;

  for (const doc of documents) {
    if (canAskDocument(doc)) askReady += 1;
    const readiness = getRetrievalReadiness(doc);
    if (readiness === "semantic_ready") semanticReady += 1;
    else if (readiness === "keyword_ready") keywordReady += 1;
    else unavailable += 1;
  }

  return {
    total: documents.length,
    askReady,
    keywordReady,
    semanticReady,
    unavailable,
    label,
  };
}
