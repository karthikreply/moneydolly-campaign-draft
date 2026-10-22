import type { ExtractedSlots } from "./slot-extractor";

/** Weights sum to 1. Gate is 0.65, so sport + roster (0.55) is not enough. */
export const COMPLETENESS_WEIGHTS = {
  sport: 0.3,
  roster: 0.25,
  window: 0.2,
  orgName: 0.15,
  themePack: 0.1,
} as const;

export const COMPLETENESS_THRESHOLD = 0.65;

export interface CompletenessScore {
  score: number;
  /** sport AND roster AND score >= 0.65. A high score without either anchor still blocks. */
  canDraft: boolean;
  missingSlots: string[];
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

export function scoreBriefCompleteness(slots: ExtractedSlots): CompletenessScore {
  let score = 0;
  const missingSlots: string[] = [];
  const hasSport = Boolean(slots.sport);
  const hasRoster = slots.rosterSize != null && slots.rosterSize >= 1;

  if (hasSport) score += COMPLETENESS_WEIGHTS.sport;
  else missingSlots.push("sport");

  if (hasRoster) score += COMPLETENESS_WEIGHTS.roster;
  else missingSlots.push("roster");

  if (slots.windowStart) score += COMPLETENESS_WEIGHTS.window;
  else missingSlots.push("window");

  if (slots.orgDisplayName?.trim()) score += COMPLETENESS_WEIGHTS.orgName;
  else missingSlots.push("orgName");

  if (slots.themeKey) score += COMPLETENESS_WEIGHTS.themePack;
  else missingSlots.push("themePack");

  const rounded = roundScore(score);
  return {
    score: rounded,
    canDraft: hasSport && hasRoster && rounded >= COMPLETENESS_THRESHOLD,
    missingSlots,
  };
}
