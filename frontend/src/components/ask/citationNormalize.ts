import type { AskCitationSnapshot, Citation } from "@/lib/api/types";

/** Strip raw model chunk markers so they never appear in the Ask UI. */
const BRACKETED_CHUNK_GROUP_RE =
  /\[\s*chunk:\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:\s*,\s*chunk:\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})*\s*\]/gi;
const BRACKETED_CHUNK_LEFTOVER_RE = /\[chunk:[^\]]*\]/gi;
const BARE_CHUNK_ID_RE =
  /chunk:\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/gi;
const CHUNK_ID_IN_GROUP_RE =
  /chunk:\s*([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/gi;

export function stripRawChunkMarkers(text: string): string {
  return text
    .replace(BRACKETED_CHUNK_GROUP_RE, "")
    .replace(BRACKETED_CHUNK_LEFTOVER_RE, "")
    .replace(BARE_CHUNK_ID_RE, "");
}

/** Rewrite raw chunk markers to display numbers using citation snapshots. */
export function rewriteChunkMarkersForDisplay(
  text: string,
  citations: Array<AskCitationSnapshot | Citation>,
): string {
  const idToNumber = new Map<string, number>();
  citations.forEach((raw, index) => {
    const n = raw.display_number ?? index + 1;
    if (raw.chunk_id) idToNumber.set(String(raw.chunk_id).toLowerCase(), n);
  });

  let rewritten = text.replace(BRACKETED_CHUNK_GROUP_RE, (group) => {
    const numbers: number[] = [];
    CHUNK_ID_IN_GROUP_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CHUNK_ID_IN_GROUP_RE.exec(group)) !== null) {
      const n = idToNumber.get(match[1].toLowerCase());
      if (n != null && !numbers.includes(n)) numbers.push(n);
    }
    return numbers.map((n) => `[${n}]`).join("");
  });

  rewritten = stripRawChunkMarkers(rewritten);
  return normalizeDisplayCitationTextForTest(rewritten);
}

/** Mirrors backend normalize_display_citation_text for UI unit coverage. */
export function normalizeDisplayCitationTextForTest(text: string): string {
  let cleaned = text;
  let previous: string | null = null;
  while (previous !== cleaned) {
    previous = cleaned;
    cleaned = cleaned.replace(/\[(\d+)\](?:\s*)\[\1\]/g, "[$1]");
  }
  cleaned = cleaned.replace(/\[(\d+)\]\s+([.,;:!?])/g, "[$1]$2");
  cleaned = cleaned.replace(/[^\S\n]{2,}/g, " ");
  cleaned = cleaned.replace(/\s+([.,;:!?])/g, "$1");
  return cleaned.trim();
}
