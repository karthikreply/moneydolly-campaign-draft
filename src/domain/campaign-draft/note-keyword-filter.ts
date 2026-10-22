import type { NoteFilterResult } from "./types";

const NONE: NoteFilterResult = {
  type: "none",
  label: "No price filter detected",
};

/**
 * Best-effort keyword filter only — not NLP.
 * Unmatched notes must return type "none" with an honest label.
 */
export function parseNoteFilter(note: string): NoteFilterResult {
  const text = (note ?? "").trim();
  if (!text) return NONE;

  const under = text.match(/\bunder\s*\$?\s*(\d+)\b/i);
  if (under) {
    const dollars = Number(under[1]);
    return {
      type: "max_price",
      amountCents: dollars * 100,
      label: `Price filter: under $${dollars}`,
    };
  }

  const max = text.match(/\bmax\s*\$?\s*(\d+)\b/i);
  if (max) {
    const dollars = Number(max[1]);
    return {
      type: "max_price",
      amountCents: dollars * 100,
      label: `Price filter: max $${dollars}`,
    };
  }

  if (/\bno\s+apparel\b/i.test(text)) {
    return {
      type: "exclude_tag",
      tag: "apparel",
      label: "Filter: no apparel",
    };
  }

  return NONE;
}
