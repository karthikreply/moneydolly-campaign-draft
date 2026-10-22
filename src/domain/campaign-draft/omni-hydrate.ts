import { scoreBriefCompleteness } from "./completeness";
import { runDraftRules } from "./draft-rules-engine";
import { normalizeNumberWords } from "./number-words";
import {
  extractBriefSlots,
  inclusiveWindowEnd,
  todayIsoUtc,
  type ExtractedSlots,
} from "./slot-extractor";
import type { CampaignBrief, CatalogSku, DraftRulesResult, SportPreset } from "./types";

export interface OmniHydration {
  normalized: string;
  extractedSlots: ExtractedSlots;
  missingSlots: string[];
  score: number;
  canDraft: boolean;
  defaultedFields: string[];
  brief?: CampaignBrief;
  rules?: DraftRulesResult;
}

/**
 * Turn gated slots into a brief, applying the locked defaults:
 * no start → today + 14 days; start only → +14 days; no org → "Program"; no theme → classic.
 * Caller must have verified sport and rosterSize are present.
 */
export function buildBriefFromSlots(
  extractedSlots: ExtractedSlots & { sport: string; rosterSize: number },
  now: Date,
): CampaignBrief {
  const defaultedFields: string[] = [];
  let windowStart = extractedSlots.windowStart;
  let windowEnd = extractedSlots.windowEnd;

  if (!windowStart) {
    windowStart = todayIsoUtc(now);
    windowEnd = inclusiveWindowEnd(windowStart);
    defaultedFields.push("windowDays");
  } else if (!extractedSlots.windowEndMentioned) {
    windowEnd = inclusiveWindowEnd(windowStart);
    defaultedFields.push("windowEnd");
  }

  if (!extractedSlots.orgDisplayName?.trim()) defaultedFields.push("orgName");
  if (!extractedSlots.themeKey) defaultedFields.push("themePack");

  return {
    sport: extractedSlots.sport,
    rosterSize: extractedSlots.rosterSize,
    orgDisplayName: extractedSlots.orgDisplayName?.trim() || "Program",
    windowStart: windowStart ?? "",
    windowEnd: windowEnd ?? "",
    note: extractedSlots.note ?? "",
    themeKey: extractedSlots.themeKey ?? "classic_season",
    defaultedFields,
  };
}

export function hydrateOmniBrief(input: {
  utterance: string;
  preset: SportPreset;
  catalog: CatalogSku[];
  now?: Date;
}): OmniHydration {
  const now = input.now ?? new Date();
  const normalized = normalizeNumberWords(input.utterance);
  const extractedSlots = extractBriefSlots(normalized, now);
  const scored = scoreBriefCompleteness(extractedSlots);

  if (!scored.canDraft || !extractedSlots.sport || extractedSlots.rosterSize == null) {
    return {
      normalized,
      extractedSlots,
      missingSlots: scored.missingSlots,
      score: scored.score,
      canDraft: false,
      defaultedFields: [],
    };
  }

  const brief = buildBriefFromSlots(
    { ...extractedSlots, sport: extractedSlots.sport, rosterSize: extractedSlots.rosterSize },
    now,
  );
  const defaultedFields = brief.defaultedFields ?? [];

  return {
    normalized,
    extractedSlots,
    missingSlots: scored.missingSlots,
    score: scored.score,
    canDraft: true,
    defaultedFields,
    brief,
    rules: runDraftRules({
      brief,
      preset: input.preset,
      catalog: input.catalog,
    }),
  };
}
