import { parseNoteFilter } from "./note-keyword-filter";
import { resolveThemePack } from "./theme-packs";
import type {
  CampaignBrief,
  CatalogSku,
  DraftRulesResult,
  NoteFilterResult,
  SportPreset,
  SurfaceOrder,
} from "./types";

const MAX_PRODUCT_SKUS = 5;

function applyNoteFilter(
  products: CatalogSku[],
  filter: NoteFilterResult,
): CatalogSku[] {
  if (filter.type === "max_price") {
    return products.filter((s) => s.retailCents <= filter.amountCents);
  }
  if (filter.type === "exclude_tag") {
    return products.filter((s) => !s.tags.includes(filter.tag));
  }
  return products;
}

function scoreSku(
  sku: CatalogSku,
  sportTags: string[],
  themeTags: string[],
): number {
  let score = 0;
  for (const t of sku.tags) {
    if (sportTags.includes(t)) score += 2;
    if (themeTags.includes(t)) score += 3;
  }
  return score;
}

function pickSkus(
  catalog: CatalogSku[],
  preset: SportPreset,
  filter: NoteFilterResult,
  themeTags: string[],
): { skuIds: string[]; surfaceOrder: SurfaceOrder } {
  const donation = catalog.find((s) => s.kind === "donation");
  let products = catalog.filter((s) => s.kind === "product");

  products = applyNoteFilter(products, filter);

  const ranked = [...products].sort((a, b) => {
    const diff =
      scoreSku(b, preset.defaultProductTags, themeTags) -
      scoreSku(a, preset.defaultProductTags, themeTags);
    if (diff !== 0) return diff;
    return a.retailCents - b.retailCents;
  });

  const selectedProducts = ranked
    .filter((s) => scoreSku(s, preset.defaultProductTags, themeTags) > 0)
    .slice(0, MAX_PRODUCT_SKUS);

  const pool =
    selectedProducts.length > 0 ? selectedProducts : ranked.slice(0, MAX_PRODUCT_SKUS);

  const skuIds: string[] = [];
  if (donation) skuIds.push(donation.id);
  for (const p of pool) skuIds.push(p.id);

  const hasProduct = pool.length > 0;
  const surfaceOrder: SurfaceOrder = hasProduct
    ? "shop_first"
    : preset.defaultSurfaceOrder === "shop_first" && !hasProduct
      ? "donate_first"
      : preset.defaultSurfaceOrder;

  return { skuIds, surfaceOrder };
}

function clampGoal(goal: number, preset: SportPreset): number {
  let next = goal;
  if (preset.minGoalCents != null) next = Math.max(next, preset.minGoalCents);
  if (preset.maxGoalCents != null) next = Math.min(next, preset.maxGoalCents);
  return next;
}

export function runDraftRules(input: {
  brief: CampaignBrief;
  preset: SportPreset;
  catalog: CatalogSku[];
}): DraftRulesResult {
  const { brief, preset, catalog } = input;
  const theme = resolveThemePack(brief.themeKey);
  const noteFilter = parseNoteFilter(brief.note);

  const rawGoal = brief.rosterSize * preset.dollarsPerPlayerCents;
  const goalCents = clampGoal(rawGoal, preset);

  const { skuIds, surfaceOrder } = pickSkus(
    catalog,
    preset,
    noteFilter,
    theme.productTags,
  );

  const dollarsPerPlayer = (preset.dollarsPerPlayerCents / 100).toFixed(0);
  const whyRules = [
    `Goal = ${brief.rosterSize} players × $${dollarsPerPlayer}/player = $${(goalCents / 100).toLocaleString("en-US")}`,
    `Preset: ${preset.displayName} v${preset.version}`,
    `Theme: ${theme.name} (tags: ${theme.productTags.join(", ")})`,
    noteFilter.type === "none"
      ? noteFilter.label
      : `Applied ${noteFilter.label}`,
  ].join(". ");

  return {
    goalCents,
    skuIds,
    surfaceOrder,
    whyRules,
    noteFilter,
  };
}
