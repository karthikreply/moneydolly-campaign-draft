import { normalizeNumberWords } from "../campaign-draft/number-words";
import type { CatalogSku } from "../campaign-draft/types";
import type { CampaignThemePack } from "../campaign-draft/theme-packs";
import {
  contrast,
  extractColorHint,
  mintAaaPalette,
  paletteMeetsAaa,
} from "./aaa-palette";
import type {
  DraftTemplatePack,
  GenerateTemplatePackContext,
  GenerateTemplatePackResult,
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

function parseDollarCents(text: string, label: string): number | null {
  const re = new RegExp(
    String.raw`${label}[^$]*\$[\s,]*([\d,]+(?:\.\d{2})?)`,
    "i",
  );
  const m = text.match(re);
  if (!m) return null;
  const dollars = parseFloat(m[1].replace(/,/g, ""));
  return Math.round(dollars * 100);
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

function parseSkuCount(text: string): number {
  const m = text.match(/\b(\d+)\s+(?:branded\s+)?(?:merch|product|sku|item)/i);
  if (m) return Math.max(1, Math.min(6, parseInt(m[1], 10)));
  const word = text.match(/\b(five|four|six)\s+(?:branded\s+)?(?:merch|product|item)/i);
  if (word) {
    const map: Record<string, number> = { four: 4, five: 5, six: 6 };
    return map[word[1].toLowerCase()] ?? 5;
  }
  return 5;
}

function extractSportKey(text: string): { key: string; display: string } | null {
  const lower = text.toLowerCase();
  for (const sport of KNOWN_SPORTS) {
    if (new RegExp(String.raw`\b${sport.key}\b`, "i").test(lower)) {
      return { key: sport.key, display: sport.display };
    }
  }
  const templateMatch = lower.match(/\b([a-z]{4,})\s+template\b/);
  if (templateMatch && templateMatch[1] !== "spring" && templateMatch[1] !== "create") {
    const key = templateMatch[1];
    return { key, display: titleCase(key) };
  }
  return null;
}

function extractAdjectives(text: string): string[] {
  const lower = text.toLowerCase();
  return THEME_ADJECTIVES.filter((adj) => new RegExp(String.raw`\b${adj}\b`, "i").test(lower));
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

function mintSkus(
  sportKey: string,
  sportTags: string[],
  count: number,
  priceCapCents: number | null,
  bias: ReturnType<typeof merchBias>,
  themeTags: string[],
): CatalogSku[] {
  let templates = [...MERCH_TEMPLATES];
  if (bias === "merch") templates = templates.filter((t) => t.kind === "merch");
  else if (bias === "apparel") templates = templates.filter((t) => t.kind === "apparel");
  else if (bias === "gear") templates = templates.filter((t) => t.kind === "gear");

  const cap = priceCapCents ?? 4500;
  const picked = templates.filter((t) => t.retail <= cap).slice(0, count);
  while (picked.length < count && picked.length < MERCH_TEMPLATES.length) {
    const next = MERCH_TEMPLATES[picked.length];
    if (next.retail <= cap) picked.push(next);
    else break;
  }

  return picked.slice(0, count).map((tpl, index) => {
    const retail = Math.min(tpl.retail, cap);
    const groupCreditCents = Math.round(retail * 0.33);
    const id = `sku_${sportKey}_${slugKey([tpl.suffix])}_${index + 1}`;
    return {
      id,
      name: `${titleCase(sportKey)} ${tpl.suffix}`,
      retailCents: retail,
      groupCreditCents,
      shipHandlingCents: retail >= 3000 ? 699 : 499,
      tags: [...sportTags, tpl.kind, ...themeTags.slice(0, 2)],
      kind: "product" as const,
    };
  });
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
  const dollarsPerPlayerCents = Math.max(5_000, Math.round(mid / meta.roster));

  return {
    sportKey: sport.key,
    displayName: sport.display,
    dollarsPerPlayerCents,
    minGoalCents: minGoalCents,
    maxGoalCents: maxGoalCents,
    defaultProductTags: meta.tags,
    defaultSurfaceOrder: "shop_first",
    version: 1,
  };
}

function mintThemePack(
  sport: { key: string; display: string },
  adjectives: string[],
  prompt: string,
): CampaignThemePack {
  const colorHint = extractColorHint(prompt);
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
    description: `${name} fundraiser look with ${colorHint.family} accents.`,
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

export function generateTemplatePack(
  prompt: string,
  _ctx: GenerateTemplatePackContext = {},
): GenerateTemplatePackResult {
  const normalized = normalizeNumberWords(prompt);
  const sport = extractSportKey(normalized);
  const adjectives = extractAdjectives(normalized);
  const minGoalCents = parseMinGoalCents(normalized);
  const maxGoalCents = parseMaxGoalCents(normalized);
  const priceCapCents = parsePriceCapCents(normalized);
  const skuCount = parseSkuCount(normalized);
  const bias = merchBias(normalized);

  if (!sport) {
    return {
      pack: emptyDraftPack(),
      reply: "Which sport or program should this template target?",
      suggestions: ["Volleyball spring template", "Lacrosse merch under $35", "Soccer community theme"],
      canPublish: false,
    };
  }

  const sportPreset = mintSportPreset(sport, minGoalCents, maxGoalCents);
  const theme = mintThemePack(sport, adjectives, normalized);
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

  const parts: string[] = [`Got ${sport.key}`];
  const colorHint = extractColorHint(normalized);
  if (colorHint.neon || colorHint.family === "green") parts.push("neon green");
  if (minGoalCents != null) parts.push(`min $${(minGoalCents / 100).toLocaleString()}`);
  if (maxGoalCents != null) parts.push(`max $${(maxGoalCents / 100).toLocaleString()}`);
  parts.push(`${catalogSkus.length} items${priceCapCents != null ? ` under $${priceCapCents / 100}` : ""}`);

  const suggestions: string[] = [];
  if (minGoalCents == null) suggestions.push(`Set min goal $2,000 for ${sport.display}`);
  if (priceCapCents == null) suggestions.push("Add under $35 for retail cap");

  return {
    pack,
    reply: parts.join(" · "),
    suggestions,
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
  for (const sku of pack.catalogSkus) {
    if (sku.retailCents <= 0) continue;
  }
  void contrast;
}
