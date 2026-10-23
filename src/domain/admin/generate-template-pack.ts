import { normalizeNumberWords } from "../campaign-draft/number-words";
import type { CatalogSku } from "../campaign-draft/types";
import type { CampaignThemePack } from "../campaign-draft/theme-packs";
import {
  baseAccentFor,
  contrast,
  extractColorHint,
  minTextContrast,
  mintAaaPalette,
  paletteMeetsAaa,
  type ColorHint,
} from "./aaa-palette";
import type {
  DraftTemplatePack,
  GenerateTemplatePackContext,
  GenerateTemplatePackResult,
  TemplateBuildStep,
  TemplateRefinement,
  TemplateSportPreset,
} from "./template-pack-types";

const KNOWN_SPORTS: { key: string; display: string; roster: number; tags: string[] }[] = [
  { key: "lacrosse", display: "Lacrosse", roster: 22, tags: ["lacrosse"] },
  { key: "volleyball", display: "Volleyball", roster: 16, tags: ["volleyball"] },
  { key: "basketball", display: "Basketball", roster: 15, tags: ["basketball"] },
  { key: "soccer", display: "Soccer", roster: 20, tags: ["soccer"] },
  { key: "football", display: "Football", roster: 40, tags: ["football"] },
  { key: "baseball", display: "Baseball", roster: 20, tags: ["baseball"] },
  { key: "softball", display: "Softball", roster: 18, tags: ["softball"] },
  { key: "hockey", display: "Hockey", roster: 20, tags: ["hockey"] },
  { key: "general", display: "General / other", roster: 20, tags: ["generic"] },
];

const THEME_ADJECTIVES = [
  "spring",
  "fall",
  "winter",
  "summer",
  "championship",
  "spirit",
  "community",
  "classic",
  "night",
  "neon",
];

const SEASONS = ["spring", "fall", "winter", "summer"];

/** Words that can sit before "template" without naming a program. */
const NOT_A_SPORT = ["create", "this", "that", "same", "your", "next", "whole", "every", "another", "first", "current", "new", "make"];

const DEFAULT_PRICE_CAP_CENTS = 4500;
const DEFAULT_SKU_COUNT = 5;
const GROUP_CREDIT_SHARE = 0.33;

const MERCH_TEMPLATES = [
  { suffix: "Spirit Tee", kind: "apparel" as const, retail: 2200 },
  { suffix: "Performance Hoodie", kind: "apparel" as const, retail: 3400 },
  { suffix: "Sideline Cap", kind: "merch" as const, retail: 1800 },
  { suffix: "Team Water Bottle", kind: "gear" as const, retail: 1500 },
  { suffix: "Sticker Pack", kind: "merch" as const, retail: 800 },
  { suffix: "Training Towel", kind: "merch" as const, retail: 1600 },
  { suffix: "Drawstring Bag", kind: "merch" as const, retail: 2400 },
  { suffix: "Warm-up Shorts", kind: "apparel" as const, retail: 3200 },
];

type MerchKind = (typeof MERCH_TEMPLATES)[number]["kind"];

const COLOR_LABEL: Record<ColorHint["family"], string> = {
  green: "green",
  blue: "blue",
  red: "red",
  orange: "orange",
  purple: "purple",
  teal: "teal",
  neutral: "forest green",
};

function slugKey(parts: string[]): string {
  return parts
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function parseDollarCents(text: string, label: string): number | null {
  const re = new RegExp(
    String.raw`${label}[^$]*\$[\s,]*([\d,]+(?:\.\d{2})?)`,
    "i",
  );
  const m = text.match(re);
  if (!m) return null;
  const amount = parseFloat(m[1].replace(/,/g, ""));
  return Math.round(amount * 100);
}

function parseMaxGoalCents(text: string): number | null {
  const maxLabeled = parseDollarCents(text, "max");
  if (maxLabeled != null) return maxLabeled;
  const m = text.match(/\bmax(?:imum)?\s*(?:goal\s*)?\$[\s,]*([\d,]+)/i);
  if (m) return Math.round(parseFloat(m[1].replace(/,/g, "")) * 100);
  return null;
}

function parseMinGoalCents(text: string): number | null {
  const minLabeled = parseDollarCents(text, "min");
  if (minLabeled != null) return minLabeled;
  const m = text.match(/\bmin(?:imum)?\s*(?:goal\s*)?\$[\s,]*([\d,]+)/i);
  if (m) return Math.round(parseFloat(m[1].replace(/,/g, "")) * 100);
  return null;
}

function parsePriceCapCents(text: string): number | null {
  const under = text.match(/\bunder\s*\$[\s,]*([\d,]+)/i);
  if (under) return Math.round(parseFloat(under[1].replace(/,/g, "")) * 100);
  const cap = text.match(/\b(?:cap|max\s*price)\s*\$[\s,]*([\d,]+)/i);
  if (cap) return Math.round(parseFloat(cap[1].replace(/,/g, "")) * 100);
  return null;
}

const COUNT_PATTERN = /\b(\d+)\s+((?:branded\s+)?(?:apparel\s+|gear\s+|merch\s+)?)(merch|products?|skus?|items?)\b/i;

function parseSkuCount(text: string): { count: number; explicit: boolean } {
  const m = text.match(COUNT_PATTERN);
  if (m) return { count: Math.max(1, Math.min(6, parseInt(m[1], 10))), explicit: true };
  const word = text.match(/\b(five|four|six)\s+(?:branded\s+)?(?:merch|product|item)/i);
  if (word) {
    const map: Record<string, number> = { four: 4, five: 5, six: 6 };
    return { count: map[word[1].toLowerCase()] ?? DEFAULT_SKU_COUNT, explicit: true };
  }
  return { count: DEFAULT_SKU_COUNT, explicit: false };
}

export const TEMPLATE_SEASONS = SEASONS;
export const TEMPLATE_ADJECTIVES = THEME_ADJECTIVES.filter((a) => a !== "neon");

/** Sport or program named in free text, using the same rules as the pack builder. */
export function detectTemplateSport(text: string): { key: string; display: string } | null {
  const sport = extractSport(normalizeNumberWords(text));
  return sport ? { key: sport.key, display: sport.display } : null;
}

function extractSport(text: string): { key: string; display: string; word: string } | null {
  for (const sport of KNOWN_SPORTS) {
    const m = text.match(new RegExp(String.raw`\b${sport.key}\b`, "i"));
    if (m) return { key: sport.key, display: sport.display, word: m[0] };
  }
  const templateMatch = text.match(/\b([a-z]{4,})\s+template\b/i);
  const candidate = templateMatch?.[1].toLowerCase();
  if (candidate && !THEME_ADJECTIVES.includes(candidate) && !NOT_A_SPORT.includes(candidate)) {
    return { key: candidate, display: titleCase(candidate), word: templateMatch![1] };
  }
  return null;
}

function extractAdjectives(text: string): string[] {
  return THEME_ADJECTIVES.filter((adj) => new RegExp(String.raw`\b${adj}\b`, "i").test(text));
}

function merchBias(text: string): "merch" | "apparel" | "gear" | "mixed" {
  const lower = text.toLowerCase();
  if (/\bno\s+apparel\b/.test(lower)) return "gear";
  if (/\bapparel\b/.test(lower) && !/\bmerch\b/.test(lower)) return "apparel";
  if (/\bmerch\b/.test(lower)) return "merch";
  if (/\bgear\b/.test(lower)) return "gear";
  return "mixed";
}

function buildThemeName(sportDisplay: string, adjectives: string[]): string {
  const filtered = adjectives.filter((a) => a !== "neon");
  const head = filtered.length ? filtered.map(titleCase).join(" ") : "Classic";
  return `${head} ${sportDisplay}`.trim();
}

/** Preferred kind first, then any other template under the cap. Never repeats a template. */
function mintSkus(
  sportKey: string,
  sportTags: string[],
  count: number,
  priceCapCents: number | null,
  bias: ReturnType<typeof merchBias>,
  themeTags: string[],
): CatalogSku[] {
  const cap = priceCapCents ?? DEFAULT_PRICE_CAP_CENTS;
  const underCap = MERCH_TEMPLATES.filter((t) => t.retail <= cap);
  const preferred = bias === "mixed" ? underCap : underCap.filter((t) => t.kind === bias);
  const rest = underCap.filter((t) => !preferred.includes(t));
  const picked = [...preferred, ...rest].slice(0, count);

  return picked.map((tpl, index) => {
    const groupCreditCents = Math.round(tpl.retail * GROUP_CREDIT_SHARE);
    return {
      id: `sku_${sportKey}_${slugKey([tpl.suffix])}_${index + 1}`,
      name: `${titleCase(sportKey)} ${tpl.suffix}`,
      retailCents: tpl.retail,
      groupCreditCents,
      shipHandlingCents: tpl.retail >= 3000 ? 699 : 499,
      tags: [...sportTags, tpl.kind, ...themeTags.slice(0, 2)],
      kind: "product" as const,
    };
  });
}

/** Roster the $/player math assumes for this sport. */
export function typicalRosterFor(sportKey: string): number {
  return (KNOWN_SPORTS.find((s) => s.key === sportKey) ?? KNOWN_SPORTS[KNOWN_SPORTS.length - 1]).roster;
}

function mintSportPreset(
  sport: { key: string; display: string },
  minGoalCents: number | null,
  maxGoalCents: number | null,
): TemplateSportPreset {
  const meta = KNOWN_SPORTS.find((s) => s.key === sport.key) ?? KNOWN_SPORTS[KNOWN_SPORTS.length - 1];
  const min = minGoalCents ?? 50_000;
  const max = maxGoalCents ?? 5_000_000;
  const mid = (min + max) / 2;
  const dollarsPerPlayerCents = Math.max(5_000, Math.round(mid / meta.roster / 100) * 100);

  return {
    sportKey: sport.key,
    displayName: sport.display,
    dollarsPerPlayerCents,
    minGoalCents,
    maxGoalCents,
    defaultProductTags: meta.key === "general" ? meta.tags : [sport.key],
    defaultSurfaceOrder: "shop_first",
    version: 1,
  };
}

function mintThemePack(
  sport: { key: string; display: string },
  adjectives: string[],
  colorHint: ColorHint,
): CampaignThemePack {
  const colors = mintAaaPalette(colorHint);
  const name = buildThemeName(sport.display, adjectives);
  const key = slugKey([...adjectives.filter((a) => a !== "neon"), sport.key]);
  const productTags = [
    sport.key,
    ...adjectives.filter((a) => !["neon", "classic"].includes(a)),
    "merch",
  ];

  return {
    key,
    name,
    description: `${name} fundraiser look with ${colorLabel(colorHint)} accents.`,
    productTags,
    copyTone: adjectives.includes("spirit")
      ? "energetic, pep-rally, short punches"
      : "straightforward, proud, community",
    headlineVerb: adjectives.includes("community") ? "Stand with" : "Support",
    colors,
    fonts: {
      display: 'var(--font-grotesk), "Segoe UI", sans-serif',
      body: 'var(--font-grotesk), "Segoe UI", sans-serif',
    },
    displayStyle: { weight: 600, letterSpacing: "-0.02em" },
  };
}

function colorLabel(hint: ColorHint): string {
  const base = COLOR_LABEL[hint.family];
  return hint.neon ? `neon ${base}` : base;
}

function goalsLabel(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${dollars(min)} – ${dollars(max)}`;
  if (min != null) return `From ${dollars(min)}, no ceiling`;
  if (max != null) return `Up to ${dollars(max)}, no floor`;
  return "No limits set";
}

function kindMix(skus: CatalogSku[]): string {
  const counts = new Map<MerchKind, number>();
  for (const sku of skus) {
    const kind = (["apparel", "merch", "gear"] as const).find((k) => sku.tags.includes(k));
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts.entries()].map(([kind, n]) => `${n} ${kind}`).join(", ");
}

function buildSteps(input: {
  sport: { key: string; display: string };
  theme: CampaignThemePack;
  colorHint: ColorHint;
  preset: TemplateSportPreset;
  skus: CatalogSku[];
  priceCapCents: number | null;
  countExplicit: boolean;
}): TemplateBuildStep[] {
  const { sport, theme, colorHint, preset, skus, priceCapCents, countExplicit } = input;
  const ratio = minTextContrast(theme.colors);
  const repaired = theme.colors.accent.toLowerCase() !== baseAccentFor(colorHint).toLowerCase();
  const roster = typicalRosterFor(sport.key);
  const bothBounds = preset.minGoalCents != null && preset.maxGoalCents != null;
  const cap = priceCapCents ?? DEFAULT_PRICE_CAP_CENTS;

  return [
    {
      id: "sport",
      label: "Sport",
      value: sport.display,
      detail: KNOWN_SPORTS.some((s) => s.key === sport.key)
        ? `New preset key "${sport.key}".`
        : `New program "${sport.key}". Typical roster assumed at ${roster}.`,
      status: "found",
    },
    {
      id: "look",
      label: "Look",
      value: `${theme.name} · ${colorLabel(colorHint)}`,
      detail: `${repaired ? "Accent darkened for readability. " : ""}Text contrast ${ratio.toFixed(1)}:1 (AAA needs 7:1).`,
      status: colorHint.family === "neutral" ? "assumed" : "found",
    },
    {
      id: "goals",
      label: "Goal limits",
      value: goalsLabel(preset.minGoalCents, preset.maxGoalCents),
      detail: `${dollars(preset.dollarsPerPlayerCents)} per player, based on a ${roster}-player roster.`,
      status: bothBounds ? "found" : "assumed",
    },
    {
      id: "catalog",
      label: "Catalog",
      value: `${skus.length} items under ${dollars(cap)}`,
      detail: `${kindMix(skus)}. About a third of each sale counts toward the goal; shipping never does.`,
      status: priceCapCents != null && countExplicit ? "found" : "assumed",
    },
    {
      id: "ready",
      label: "Ready",
      value: "Ready to publish",
      detail: `Directors will see ${sport.display} in the Brief and the Agent once it's live.`,
      status: "found",
    },
  ];
}

function missingSportSteps(): TemplateBuildStep[] {
  return [
    {
      id: "sport",
      label: "Sport",
      value: "Not found",
      detail: "Name a sport or program, for example lacrosse or marching band.",
      status: "missing",
    },
    {
      id: "ready",
      label: "Ready",
      value: "Waiting on a sport",
      detail: "Goal limits and items are built per sport.",
      status: "missing",
    },
  ];
}

function stripEnd(prompt: string): string {
  return prompt.trim().replace(/[.!\s]+$/, "");
}

function replaceOrAppend(prompt: string, pattern: RegExp, replacement: string, appended: string): string {
  if (pattern.test(prompt)) return prompt.replace(pattern, replacement);
  return `${stripEnd(prompt)}, ${appended}.`;
}

/** Deterministic rewrites of the admin's own sentence, so every refinement stays visible and editable. */
function buildRefinements(input: {
  prompt: string;
  sportWord: string;
  adjectives: string[];
  colorHint: ColorHint;
  priceCapCents: number | null;
  count: number;
  bias: ReturnType<typeof merchBias>;
}): TemplateRefinement[] {
  const { prompt, sportWord, adjectives, colorHint, priceCapCents, count, bias } = input;
  const out: TemplateRefinement[] = [];

  const season = adjectives.find((a) => SEASONS.includes(a));
  const nextSeason = season === "fall" ? "spring" : "fall";
  const seasonPattern = new RegExp(String.raw`\b(${SEASONS.join("|")})\b`, "i");
  out.push({
    id: "season",
    label: `Make it ${nextSeason}`,
    prompt: seasonPattern.test(prompt)
      ? prompt.replace(seasonPattern, (m) => (m[0] === m[0].toUpperCase() ? titleCase(nextSeason) : nextSeason))
      : prompt.replace(new RegExp(String.raw`\b${sportWord}\b`), `${titleCase(nextSeason)} ${sportWord}`),
  });

  const tighter = priceCapCents == null || priceCapCents > 2500;
  out.push({
    id: "cap",
    label: tighter ? "Cap items at $25" : "Allow up to $45",
    prompt: replaceOrAppend(
      prompt,
      /\bunder\s*\$[\s,]*[\d,]+/i,
      tighter ? "under $25" : "under $45",
      tighter ? "items under $25" : "items under $45",
    ),
  });

  const nextCount = count < 6 ? 6 : 4;
  out.push({
    id: "count",
    label: nextCount === 6 ? "Six items" : "Four items",
    prompt: replaceOrAppend(prompt, COUNT_PATTERN, `${nextCount} $2$3`, `${nextCount} items`),
  });

  if (bias === "merch") {
    out.push({
      id: "mix",
      label: "Mix in apparel",
      prompt: prompt.replace(/\b(branded\s+)?merch\s+(items?|products?)\b/i, "$1$2").replace(/\bmerch\b/i, "items"),
    });
  } else if (bias === "mixed") {
    out.push({
      id: "mix",
      label: "Merch only",
      prompt: replaceOrAppend(prompt, /\b(\d+)\s+((?:branded\s+)?)(items?|products?)\b/i, "$1 $2merch items", "merch only"),
    });
  }

  const colorPattern = /\b(neon\s+green|green|neon|blue|red|maroon|orange|purple|violet|teal|turquoise)\b/i;
  const toBlue = colorHint.family === "green" || colorHint.family === "neutral";
  out.push({
    id: "color",
    label: toBlue ? "Try navy blue" : "Try neon green",
    prompt: replaceOrAppend(
      prompt,
      colorPattern,
      toBlue ? "navy blue" : "neon green",
      toBlue ? "navy blue accents" : "neon green accents",
    ),
  });

  return out;
}

export function generateTemplatePack(
  prompt: string,
  _ctx: GenerateTemplatePackContext = {},
): GenerateTemplatePackResult {
  const normalized = normalizeNumberWords(prompt);
  const sport = extractSport(normalized);
  const adjectives = extractAdjectives(normalized);
  const minGoalCents = parseMinGoalCents(normalized);
  const maxGoalCents = parseMaxGoalCents(normalized);
  const priceCapCents = parsePriceCapCents(normalized);
  const { count: skuCount, explicit: countExplicit } = parseSkuCount(normalized);
  const bias = merchBias(normalized);
  const colorHint = extractColorHint(normalized);

  if (!sport) {
    const examples = ["Lacrosse", "Volleyball", "Marching band"];
    return {
      pack: emptyDraftPack(),
      reply: "Which sport or program should this template target?",
      suggestions: ["Volleyball spring template", "Lacrosse merch under $35", "Soccer community theme"],
      steps: missingSportSteps(),
      refinements: examples.map((name) => ({
        id: `sport_${slugKey([name])}`,
        label: `For ${name.toLowerCase()}`,
        prompt: `${stripEnd(prompt)} for a ${name} template.`,
      })),
      canPublish: false,
    };
  }

  const sportPreset = mintSportPreset(sport, minGoalCents, maxGoalCents);
  const theme = mintThemePack(sport, adjectives, colorHint);
  const catalogSkus = mintSkus(
    sport.key,
    sportPreset.defaultProductTags,
    skuCount,
    priceCapCents,
    bias,
    theme.productTags,
  );

  const pack: DraftTemplatePack = {
    id: `draft_${slugKey([sport.key, theme.key, String(Date.now())])}`,
    sportPreset,
    theme,
    catalogSkus,
    tags: [...new Set([sport.key, ...adjectives, ...theme.productTags])],
  };

  const cap = priceCapCents ?? DEFAULT_PRICE_CAP_CENTS;
  const goalsPart =
    minGoalCents == null && maxGoalCents == null
      ? "no goal limits"
      : `goals ${goalsLabel(minGoalCents, maxGoalCents)}`;
  const reply = `Built ${theme.name}: ${colorLabel(colorHint)}, ${goalsPart}, ${catalogSkus.length} items under ${dollars(cap)}.`;

  const suggestions: string[] = [];
  if (minGoalCents == null) suggestions.push(`Set min goal $2,000 for ${sport.display}`);
  if (priceCapCents == null) suggestions.push("Add under $35 for retail cap");

  return {
    pack,
    reply,
    suggestions,
    steps: buildSteps({
      sport,
      theme,
      colorHint,
      preset: sportPreset,
      skus: catalogSkus,
      priceCapCents,
      countExplicit,
    }),
    refinements: buildRefinements({
      prompt: normalized,
      sportWord: sport.word,
      adjectives,
      colorHint,
      priceCapCents,
      count: skuCount,
      bias,
    }),
    canPublish: true,
  };
}

function emptyDraftPack(): DraftTemplatePack {
  const colors = mintAaaPalette({ family: "neutral" });
  return {
    id: "draft_empty",
    sportPreset: {
      sportKey: "",
      displayName: "",
      dollarsPerPlayerCents: 10_000,
      minGoalCents: null,
      maxGoalCents: null,
      defaultProductTags: [],
      defaultSurfaceOrder: "shop_first",
      version: 1,
    },
    theme: {
      key: "pending",
      name: "Pending",
      description: "",
      productTags: [],
      copyTone: "",
      headlineVerb: "Support",
      colors,
      fonts: {
        display: 'var(--font-grotesk), "Segoe UI", sans-serif',
        body: 'var(--font-grotesk), "Segoe UI", sans-serif',
      },
    },
    catalogSkus: [],
    tags: [],
  };
}

/** @internal test helper */
export function assertGeneratedPackAaa(pack: DraftTemplatePack): void {
  if (!paletteMeetsAaa(pack.theme.colors)) {
    throw new Error("Generated palette failed AAA repair");
  }
  void contrast;
}
