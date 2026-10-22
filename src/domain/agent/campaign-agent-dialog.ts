import { scoreBriefCompleteness } from "../campaign-draft/completeness";
import { normalizeNumberWords } from "../campaign-draft/number-words";
import { buildBriefFromSlots } from "../campaign-draft/omni-hydrate";
import { extractBriefSlots, type ExtractedSlots } from "../campaign-draft/slot-extractor";
import { resolveThemePack } from "../campaign-draft/theme-packs";
import type { CampaignBrief } from "../campaign-draft/types";

/**
 * Deterministic, turn-based dialog for creating a campaign by voice or text.
 * The agent only asks for what the rules engine needs; numbers never come from an LLM.
 * Phases: collecting → review (draft exists) → published → done.
 */

export type SlotName = "sport" | "roster" | "window" | "orgName" | "themePack";

export type AgentPhase = "collecting" | "review" | "published";

export interface AgentDialogState {
  phase: AgentPhase;
  slots: ExtractedSlots;
  /** Secondary slots the director explicitly skipped; we never ask twice. */
  skipped: SlotName[];
  /** Which slot the last agent question targeted, so a bare reply can be interpreted. */
  asked?: SlotName;
  turns: number;
  draftId?: string;
}

export type AgentAction =
  | { type: "create_draft"; brief: CampaignBrief }
  | { type: "publish"; draftId: string }
  | { type: "open_studio"; draftId: string }
  | { type: "restart" };

export interface AgentStepResult {
  state: AgentDialogState;
  reply: string;
  action?: AgentAction;
  /** Visible quick replies. Voice is never the only way to answer. */
  suggestions: string[];
}

export interface AgentPersona {
  name: string;
  operatorName: string;
}

const ASK_ORDER: SlotName[] = ["sport", "roster", "window", "orgName", "themePack"];
const SECONDARY: SlotName[] = ["window", "orgName", "themePack"];

const YES = /^\s*(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|publish|ship it|launch|confirm|sounds good|looks good)\b/i;
const EDIT = /\b(edit|studio|change|tweak|open|review|adjust|fix)\b/i;
const SKIP = /^\s*(skip|no|nope|none|default|defaults|whatever|you pick|you choose|pass|not sure|dunno|don't know|later)\b/i;
const RESTART = /\b(start over|restart|new campaign|reset|again)\b/i;

const SPORT_ALIASES: Array<[RegExp, string]> = [
  [/\b(volley\s?ball|vb)\b/i, "volleyball"],
  [/\b(basket\s?ball|hoops|bball)\b/i, "basketball"],
  [/\b(soccer|futbol|football)\b/i, "soccer"],
  [/\b(general|other|band|choir|club|track|baseball|softball|swim|swimming|lacrosse|cheer|wrestling|tennis|golf|hockey)\b/i, "general"],
];

const THEME_ALIASES: Array<[RegExp, string]> = [
  [/spirit/i, "spirit_week"],
  [/spring/i, "spring_classic"],
  [/champ/i, "championship_push"],
  [/night|lights|evening/i, "night_lights"],
  [/classic|season|standard|normal|simple/i, "classic_season"],
  [/community|charity|cause|plum|rose/i, "community"],
];

export function initialAgentState(): AgentDialogState {
  return { phase: "collecting", slots: {}, skipped: [], turns: 0 };
}

export function greeting(persona: AgentPersona, greetingText: string): AgentStepResult {
  return {
    state: initialAgentState(),
    reply: greetingText,
    suggestions: [
      "Lincoln volleyball, 18 players, March 1 to April 15, spirit week",
      "Basketball, 12 players",
    ],
  };
}

function hasSlot(slots: ExtractedSlots, slot: SlotName): boolean {
  switch (slot) {
    case "sport":
      return Boolean(slots.sport);
    case "roster":
      return slots.rosterSize != null && slots.rosterSize >= 1;
    case "window":
      return Boolean(slots.windowStart);
    case "orgName":
      return Boolean(slots.orgDisplayName?.trim());
    case "themePack":
      return Boolean(slots.themeKey);
  }
}

function nextToAsk(state: AgentDialogState): SlotName | null {
  for (const slot of ASK_ORDER) {
    if (hasSlot(state.slots, slot)) continue;
    if (SECONDARY.includes(slot) && state.skipped.includes(slot)) continue;
    return slot;
  }
  return null;
}

function mergeSlots(base: ExtractedSlots, next: ExtractedSlots): ExtractedSlots {
  const merged: ExtractedSlots = { ...base };
  (Object.keys(next) as Array<keyof ExtractedSlots>).forEach((key) => {
    const value = next[key];
    if (value !== undefined && value !== "") {
      (merged as Record<string, unknown>)[key] = value;
    }
  });
  return merged;
}

/** Rewrite a bare answer into the phrasing the extractor understands, given what was asked. */
function contextualize(text: string, asked: SlotName | undefined, slots: ExtractedSlots): string {
  const trimmed = text.trim().replace(/[.!?]+$/g, "");
  if (!asked) return trimmed;
  if (asked === "roster") {
    const n = trimmed.match(/^\D*?(\d{1,3})\D*$/);
    if (n) return `${n[1]} players`;
  }
  if (asked === "orgName" && slots.sport && !/\b(volleyball|basketball|soccer|general)\b/i.test(trimmed)) {
    return `${trimmed} ${slots.sport}`;
  }
  return trimmed;
}

function aliasSport(text: string): string | undefined {
  for (const [pattern, sport] of SPORT_ALIASES) if (pattern.test(text)) return sport;
  return undefined;
}

function aliasTheme(text: string): string | undefined {
  for (const [pattern, key] of THEME_ALIASES) if (pattern.test(text)) return key;
  return undefined;
}

function describe(slots: ExtractedSlots): string {
  const parts: string[] = [];
  if (slots.orgDisplayName) parts.push(slots.orgDisplayName);
  if (slots.sport) parts.push(slots.sport);
  if (slots.rosterSize != null) parts.push(`${slots.rosterSize} players`);
  if (slots.windowStart) {
    parts.push(
      slots.windowEndMentioned && slots.windowEnd
        ? `${slots.windowStart} to ${slots.windowEnd}`
        : `starting ${slots.windowStart}`,
    );
  }
  if (slots.themeKey) parts.push(`${resolveThemePack(slots.themeKey).name} theme`);
  return parts.join(", ");
}

function question(slot: SlotName, slots: ExtractedSlots): { reply: string; suggestions: string[] } {
  switch (slot) {
    case "sport":
      return {
        reply: "Which sport or program is this for?",
        suggestions: ["Volleyball", "Basketball", "Soccer", "Something else"],
      };
    case "roster":
      return {
        reply: `How many players are on the ${slots.sport ?? ""} roster?`.replace("  ", " "),
        suggestions: ["12", "18", "25"],
      };
    case "window":
      return {
        reply:
          "When should it run? Give me a date range, or say skip for a two-week window starting today.",
        suggestions: ["March 1 to April 15", "Starting November 1", "Skip"],
      };
    case "orgName":
      return {
        reply: "What's the team or organization name supporters will see?",
        suggestions: ["Lincoln High", "Riverside Tigers", "Skip"],
      };
    case "themePack":
      return {
        reply:
          "Pick a look: Classic season, Spirit week, Spring classic, Championship push, Night lights, or Community. Or say skip for Classic.",
        suggestions: ["Community", "Spirit week", "Night lights", "Skip"],
      };
  }
}

const NOW_FALLBACK = new Date("2026-10-22T00:00:00.000Z");

export function agentStep(
  state: AgentDialogState,
  userText: string,
  persona: AgentPersona,
  now: Date = NOW_FALLBACK,
): AgentStepResult {
  const text = userText.trim();
  const turns = state.turns + 1;

  if (RESTART.test(text)) {
    return {
      state: initialAgentState(),
      reply: "Okay, starting fresh. Which sport, how many players, and when?",
      action: { type: "restart" },
      suggestions: ["Soccer, 20 players, starting November 1"],
    };
  }

  if (state.phase === "review" && state.draftId) {
    if (YES.test(text)) {
      return {
        state: { ...state, phase: "published", turns },
        reply: "Publishing now. You'll get the team link and a link for every player.",
        action: { type: "publish", draftId: state.draftId },
        suggestions: [],
      };
    }
    if (EDIT.test(text)) {
      return {
        state: { ...state, turns },
        reply: "Opening the studio so you can adjust the goal, products, or copy before publishing.",
        action: { type: "open_studio", draftId: state.draftId },
        suggestions: ["Publish it", "Start over"],
      };
    }
    return {
      state: { ...state, turns },
      reply: "Say publish to go live, or edit to open the studio. You always make the final call.",
      suggestions: ["Publish it", "Edit in studio", "Start over"],
    };
  }

  if (state.phase === "published") {
    return {
      state: { ...state, turns },
      reply: "That campaign is live. Say start over if you want to create another one.",
      suggestions: ["Start over"],
    };
  }

  // collecting
  let skipped = state.skipped;
  let slots = state.slots;
  const asked = state.asked;

  if (asked && SECONDARY.includes(asked) && SKIP.test(text)) {
    skipped = [...skipped, asked];
  } else {
    const normalized = contextualize(normalizeNumberWords(text), asked, slots);
    const extracted = extractBriefSlots(normalized, now);
    if (!extracted.sport) {
      const alias = aliasSport(normalized);
      if (alias) extracted.sport = alias;
    }
    if (!extracted.themeKey && (asked === "themePack" || !asked)) {
      const alias = aliasTheme(normalized);
      if (alias && asked === "themePack") extracted.themeKey = alias;
    }
    slots = mergeSlots(slots, extracted);
  }

  const working: AgentDialogState = { ...state, slots, skipped, turns, asked: undefined };
  const next = nextToAsk(working);
  const gate = scoreBriefCompleteness(slots);
  const secondariesResolved = SECONDARY.every(
    (slot) => hasSlot(slots, slot) || skipped.includes(slot),
  );

  if (!next || (gate.canDraft && secondariesResolved)) {
    if (!slots.sport || slots.rosterSize == null) {
      // Cannot happen when next is null, but keep the types honest.
      const slot = nextToAsk(working) ?? "sport";
      const q = question(slot, slots);
      return { state: { ...working, asked: slot }, reply: q.reply, suggestions: q.suggestions };
    }
    const brief = buildBriefFromSlots({ ...slots, sport: slots.sport, rosterSize: slots.rosterSize }, now);
    return {
      state: { ...working, phase: "review" },
      reply: `Got it: ${describe(slots)}. Building the draft with ${persona.operatorName}'s pricing rules now.`,
      action: { type: "create_draft", brief },
      suggestions: [],
    };
  }

  const q = question(next, slots);
  const ack = describe(slots);
  const reply = ack && turns === 1 ? `${ack}. ${q.reply}` : q.reply;
  return { state: { ...working, asked: next }, reply, suggestions: q.suggestions };
}

/** Reply once the draft API returns, moving the dialog into review. */
export function draftReadyReply(
  state: AgentDialogState,
  draft: { id: string; headline: string; goalCents: number; skuIds: string[] },
): AgentStepResult {
  const goal = `$${Math.round(draft.goalCents / 100).toLocaleString("en-US")}`;
  const products = Math.max(0, draft.skuIds.filter((id) => id !== "sku_donation").length);
  return {
    state: { ...state, phase: "review", draftId: draft.id },
    reply: `Here's the draft. Goal ${goal}, ${products} product${products === 1 ? "" : "s"} plus direct donations, headline "${draft.headline}". Publish it, or edit in the studio?`,
    suggestions: ["Publish it", "Edit in studio", "Start over"],
  };
}

export function publishedReply(
  state: AgentDialogState,
  campaign: { slug: string },
  rosterCount: number,
): AgentStepResult {
  return {
    state: { ...state, phase: "published" },
    reply: `Live. The team page is /c/${campaign.slug}, and ${rosterCount} player link${rosterCount === 1 ? " is" : "s are"} ready to share. Want to start another?`,
    suggestions: ["Start over"],
  };
}
