import { hydrateOmniBrief } from "@/domain/campaign-draft/omni-hydrate";
import { createPresetStore, resolveSportPreset } from "@/domain/campaign-draft/sport-presets";
import { STUB_CATALOG } from "@/domain/campaign-draft/stub-catalog";
import type { CampaignBrief } from "@/domain/campaign-draft/types";
import type { ExtractedSlots } from "@/domain/campaign-draft/slot-extractor";

/** Prototype clock locked to the spec: 22 Oct 2026, midnight UTC. */
export const PROTOTYPE_TODAY = new Date("2026-10-22T00:00:00.000Z");

export interface IntentHydration {
  score: number;
  canDraft: boolean;
  missingSlots: string[];
  extractedSlots: ExtractedSlots;
  defaultedFields: string[];
  brief?: CampaignBrief;
  statusLabel: string;
}

function statusLabel(score: number, missingSlots: string[], canDraft: boolean): string {
  const percent = Math.round(score * 100);
  if (canDraft) return `Completeness: ${percent}% — Ready to draft`;
  const missingAnchor = missingSlots.some((slot) => slot === "sport" || slot === "roster");
  if (missingAnchor) return `Completeness: ${percent}% — Missing Sport or Roster`;
  return `Completeness: ${percent}% — Missing ${missingSlots.join(", ")}`;
}

export function hydrateIntent(text: string): IntentHydration {
  const store = createPresetStore();
  const preset = resolveSportPreset(store, "op_demo", "general");
  const hydrated = hydrateOmniBrief({
    utterance: text,
    preset,
    catalog: STUB_CATALOG,
    now: PROTOTYPE_TODAY,
  });
  return {
    score: hydrated.score,
    canDraft: hydrated.canDraft,
    missingSlots: hydrated.missingSlots,
    extractedSlots: hydrated.extractedSlots,
    defaultedFields: hydrated.defaultedFields,
    brief: hydrated.brief,
    statusLabel: statusLabel(hydrated.score, hydrated.missingSlots, hydrated.canDraft),
  };
}
