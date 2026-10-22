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

  const brief: CampaignBrief = {
    sport: extractedSlots.sport,
    rosterSize: extractedSlots.rosterSize,
    orgDisplayName: extractedSlots.orgDisplayName?.trim() || "Program",
    windowStart: windowStart ?? "",
    windowEnd: windowEnd ?? "",
    note: extractedSlots.note ?? "",
    themeKey: extractedSlots.themeKey ?? "classic_season",
    defaultedFields,
  };

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
