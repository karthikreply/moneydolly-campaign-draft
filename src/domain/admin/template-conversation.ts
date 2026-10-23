import { normalizeNumberWords } from "../campaign-draft/number-words";
import { detectTemplateSport, TEMPLATE_ADJECTIVES, TEMPLATE_SEASONS } from "./generate-template-pack";

/** What the admin has asked for so far, in the admin's own terms. Dollars, not cents. */
export interface TemplateSpec {
  sport: string | null;
  adjectives: string[];
  color: string | null;
  minGoal: number | null;
  maxGoal: number | null;
  count: number | null;
  kind: "merch" | "apparel" | "gear" | "mixed" | null;
  priceCap: number | null;
}

export type PreviewTabKey = "supporter" | "brief" | "tokens";

export type TemplateTurn =
  | { type: "build"; spec: TemplateSpec; prompt: string; changes: string[]; fresh: boolean }
  | { type: "publish"; scope: "platform" | "operator" | null }
  | { type: "preview"; tab: PreviewTabKey }
  | { type: "reset" }
  | { type: "help" }
  | { type: "unknown" };

export const EMPTY_SPEC: TemplateSpec = {
  sport: null,
  adjectives: [],
  color: null,
  minGoal: null,
  maxGoal: null,
  count: null,
  kind: null,
  priceCap: null,
};

/** Above this, a dollar amount is a goal; at or below, it is an item price. */
const PRICE_CEILING_DOLLARS = 200;
const MAX_ITEMS = 6;

const COLOR_PHRASES: Array<{ pattern: RegExp; phrase: string }> = [
  { pattern: /\bneon\s+green\b/i, phrase: "neon green" },
  { pattern: /\bnavy(\s+blue)?\b/i, phrase: "navy blue" },
  { pattern: /\broyal\s+blue\b/i, phrase: "royal blue" },
  { pattern: /\bforest\s+green\b/i, phrase: "forest green" },
  { pattern: /\bmaroon\b/i, phrase: "maroon" },
  { pattern: /\bturquoise\b/i, phrase: "turquoise" },
  { pattern: /\bviolet\b/i, phrase: "violet" },
  { pattern: /\bgreen\b/i, phrase: "green" },
  { pattern: /\bblue\b/i, phrase: "blue" },
  { pattern: /\bred\b/i, phrase: "red" },
  { pattern: /\borange\b/i, phrase: "orange" },
  { pattern: /\bpurple\b/i, phrase: "purple" },
  { pattern: /\bteal\b/i, phrase: "teal" },
  { pattern: /\bneon\b/i, phrase: "neon green" },
];

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function money(dollars: number): string {
  return `$${dollars.toLocaleString("en-US")}`;
}

function amount(raw: string, k?: string): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  return Math.round(k ? n * 1000 : n);
}

const AMT = String.raw`\$\s*([\d,]+(?:\.\d+)?)\s*(k)?\b`;

function normalize(text: string): string {
  return normalizeNumberWords(text).replace(/\s+/g, " ").trim();
}

/** Parses only what the text says. Unset fields stay null so they can merge over an earlier spec. */
export function parseSpec(input: string): TemplateSpec & { cheaper: boolean; pricier: boolean; more: boolean; fewer: boolean; removed: string[] } {
  const text = normalize(input);
  const lower = text.toLowerCase();
  const spec = { ...EMPTY_SPEC, adjectives: [] as string[], cheaper: false, pricier: false, more: false, fewer: false, removed: [] as string[] };

  spec.sport = detectTemplateSport(text)?.display ?? null;

  for (const m of lower.matchAll(/\b(?:no|drop|remove|without)\s+(?:the\s+)?([a-z]+)/g)) {
    if (TEMPLATE_ADJECTIVES.includes(m[1])) spec.removed.push(m[1]);
  }
  spec.adjectives = TEMPLATE_ADJECTIVES.filter(
    (adj) => new RegExp(String.raw`\b${adj}\b`, "i").test(text) && !spec.removed.includes(adj),
  );

  spec.color = COLOR_PHRASES.find((c) => c.pattern.test(text))?.phrase ?? null;

  const range = text.match(new RegExp(String.raw`(?:between\s+)?${AMT}\s*(?:to|and|-|–)\s*${AMT}`, "i"));
  if (range) {
    const a = amount(range[1], range[2]);
    const b = amount(range[3], range[4]);
    if (Math.min(a, b) > PRICE_CEILING_DOLLARS) {
      spec.minGoal = Math.min(a, b);
      spec.maxGoal = Math.max(a, b);
    }
  }
  const minM = text.match(new RegExp(String.raw`\b(?:min(?:imum)?|floor|at least)\s*(?:goal\s*)?(?:of\s*|at\s*)?${AMT}`, "i"));
  if (minM) spec.minGoal = amount(minM[1], minM[2]);
  const maxM = text.match(new RegExp(String.raw`\b(?:max(?:imum)?(?!\s*price)|ceiling)\s*(?:goal\s*)?(?:of\s*|at\s*)?${AMT}`, "i"));
  if (maxM) {
    const v = amount(maxM[1], maxM[2]);
    if (v > PRICE_CEILING_DOLLARS) spec.maxGoal = v;
  }

  const priceM = text.match(
    new RegExp(String.raw`\b(?:under|below|at most|no more than|up to|max price|cap(?:\s+\w+)?\s+at|cap)\s*(?:of\s*)?${AMT}`, "i"),
  );
  if (priceM) {
    const v = amount(priceM[1], priceM[2]);
    if (v <= PRICE_CEILING_DOLLARS) spec.priceCap = v;
    else if (/\bup to\b/i.test(priceM[0]) && spec.maxGoal == null) spec.maxGoal = v;
  }
  spec.cheaper = /\b(cheaper|lower prices?|more affordable|budget)\b/.test(lower);
  spec.pricier = /\b(pricier|premium|higher prices?|more expensive)\b/.test(lower);

  const countM = text.match(/\b(\d+)\s+(?:branded\s+)?(?:apparel\s+|gear\s+|merch\s+)?(?:merch|products?|skus?|items?|pieces?)\b/i);
  if (countM) spec.count = Math.max(1, Math.min(MAX_ITEMS, parseInt(countM[1], 10)));
  spec.more = /\bmore (items|products|options)\b/.test(lower);
  spec.fewer = /\b(fewer|less) (items|products|options)\b/.test(lower);

  if (/\b(mix(ed)?|any kind|all kinds|add apparel|mix in)\b/.test(lower)) spec.kind = "mixed";
  else if (/\bapparel\b/.test(lower) && !/\bmerch\b/.test(lower)) spec.kind = "apparel";
  else if (/\bmerch\b/.test(lower)) spec.kind = "merch";
  else if (/\bgear\b/.test(lower)) spec.kind = "gear";

  return spec;
}

/** One canonical sentence the pack builder reads back exactly. */
export function composePrompt(spec: TemplateSpec): string {
  const adjectives = spec.adjectives.map(titleCase).join(" ");
  const head = spec.sport ? `${adjectives ? `${adjectives} ` : ""}${spec.sport} template` : "Template";
  const parts: string[] = [head + (spec.color ? ` with ${spec.color} accents` : "")];
  if (spec.minGoal != null) parts.push(`min goal ${money(spec.minGoal)}`);
  if (spec.maxGoal != null) parts.push(`max ${money(spec.maxGoal)}`);
  const kind = spec.kind && spec.kind !== "mixed" ? `${spec.kind} ` : "";
  if (spec.count != null || spec.priceCap != null || kind) {
    const count = spec.count != null ? `${spec.count} ` : "";
    const cap = spec.priceCap != null ? ` under ${money(spec.priceCap)}` : "";
    parts.push(`${parts.length > 1 ? "and " : ""}${count}${kind}items${cap}`);
  }
  return `${parts.join(", ")}.`;
}

function mergeSpec(base: TemplateSpec, input: string): { spec: TemplateSpec; changes: string[] } {
  const ask = parseSpec(input);
  const next: TemplateSpec = { ...base, adjectives: [...base.adjectives] };
  const changes: string[] = [];

  if (ask.sport && ask.sport !== base.sport) {
    next.sport = ask.sport;
    changes.push(`Sport → ${ask.sport}`);
  }
  const season = ask.adjectives.find((a) => TEMPLATE_SEASONS.includes(a));
  if (season) {
    next.adjectives = next.adjectives.filter((a) => !TEMPLATE_SEASONS.includes(a));
    next.adjectives.unshift(season);
    if (!base.adjectives.includes(season)) changes.push(`Season → ${titleCase(season)}`);
  }
  for (const adj of ask.adjectives.filter((a) => !TEMPLATE_SEASONS.includes(a))) {
    if (!next.adjectives.includes(adj)) {
      next.adjectives.push(adj);
      changes.push(`Style → ${titleCase(adj)}`);
    }
  }
  for (const adj of ask.removed) {
    if (next.adjectives.includes(adj)) {
      next.adjectives = next.adjectives.filter((a) => a !== adj);
      changes.push(`Removed ${titleCase(adj)}`);
    }
  }
  if (ask.color && ask.color !== base.color) {
    next.color = ask.color;
    changes.push(`Colour → ${ask.color}`);
  }
  if (ask.minGoal != null || ask.maxGoal != null) {
    next.minGoal = ask.minGoal ?? base.minGoal;
    next.maxGoal = ask.maxGoal ?? base.maxGoal;
    if (next.minGoal != null && next.maxGoal != null && next.minGoal > next.maxGoal) {
      [next.minGoal, next.maxGoal] = [next.maxGoal, next.minGoal];
    }
    changes.push(`Goals → ${next.minGoal != null ? money(next.minGoal) : "no floor"} – ${next.maxGoal != null ? money(next.maxGoal) : "no ceiling"}`);
  }
  const currentCap = base.priceCap ?? 45;
  if (ask.priceCap != null) next.priceCap = ask.priceCap;
  else if (ask.cheaper) next.priceCap = Math.max(15, currentCap - 10);
  else if (ask.pricier) next.priceCap = Math.min(60, currentCap + 10);
  if (next.priceCap !== base.priceCap && next.priceCap != null) changes.push(`Item cap → ${money(next.priceCap)}`);

  const currentCount = base.count ?? 5;
  if (ask.count != null) next.count = ask.count;
  else if (ask.more) next.count = Math.min(MAX_ITEMS, currentCount + 1);
  else if (ask.fewer) next.count = Math.max(1, currentCount - 1);
  if (next.count !== base.count && next.count != null) changes.push(`Items → ${next.count}`);

  if (ask.kind && ask.kind !== base.kind) {
    next.kind = ask.kind;
    changes.push(ask.kind === "mixed" ? "Mix → apparel, merch, and gear" : `Mix → ${ask.kind} only`);
  }
  return { spec: next, changes };
}

function isFreshRequest(text: string, current: TemplateSpec | null): boolean {
  if (!current || !current.sport) return false;
  const lower = text.toLowerCase();
  return /\btemplate\b/.test(lower) || /^(create|build|new|make a|design)\b/.test(lower);
}

/** Turns one admin message into an action on the current template. Deterministic: no model involved. */
export function interpretTemplateMessage(
  message: string,
  current: TemplateSpec | null,
  ctx: { operatorName: string },
): TemplateTurn {
  const text = message.trim();
  const lower = text.toLowerCase();
  if (!text) return { type: "unknown" };

  if (/^(start over|reset|clear|new pack|start again)\b/.test(lower)) return { type: "reset" };
  if (/^(help|what can (you|i)|examples?|what's possible|what is possible|show me what)\b/.test(lower)) return { type: "help" };

  if (/\b(publish|go live|ship it|make it live|push it live)\b/.test(lower)) {
    const operatorWord = ctx.operatorName.split(/\s+/)[0].toLowerCase();
    if (/\b(everyone|every operator|all operators|platform|everybody|all brands)\b/.test(lower)) {
      return { type: "publish", scope: "platform" };
    }
    if (lower.includes(operatorWord) || /\b(only|just)\b/.test(lower)) return { type: "publish", scope: "operator" };
    return { type: "publish", scope: null };
  }

  const show = lower.match(/\b(show|open|view|see)\b.*\b(supporter|brief|director|theme|tokens|colou?rs|contrast)\b/);
  if (show) {
    const word = show[2];
    const tab: PreviewTabKey = word === "supporter" ? "supporter" : word === "brief" || word === "director" ? "brief" : "tokens";
    return { type: "preview", tab };
  }

  if (!current || isFreshRequest(text, current)) {
    const parsed = parseSpec(text);
    const spec: TemplateSpec = {
      sport: parsed.sport ?? current?.sport ?? null,
      adjectives: parsed.adjectives,
      color: parsed.color,
      minGoal: parsed.minGoal,
      maxGoal: parsed.maxGoal,
      count: parsed.count,
      kind: parsed.kind,
      priceCap: parsed.priceCap,
    };
    return { type: "build", spec, prompt: composePrompt(spec), changes: [], fresh: true };
  }

  const { spec, changes } = mergeSpec(current, text);
  if (!changes.length) return { type: "unknown" };
  return { type: "build", spec, prompt: composePrompt(spec), changes, fresh: false };
}

/** What the agent can do, grouped for the "what's possible" panel. Every line is a working command. */
export const CAPABILITIES: Array<{ title: string; examples: string[] }> = [
  { title: "Start anything", examples: ["Band template in purple", "Basketball template"] },
  { title: "Restyle", examples: ["Make it fall", "Try navy blue", "Add spirit"] },
  { title: "Set the rules", examples: ["Goals $3k to $10k", "Cap items at $25", "Make it cheaper"] },
  { title: "Shape the catalog", examples: ["Six items", "Apparel only", "Mix in apparel"] },
  { title: "Inspect", examples: ["Show the theme", "Show the brief"] },
  { title: "Ship", examples: ["Publish it for everyone", "Publish just for us"] },
];
