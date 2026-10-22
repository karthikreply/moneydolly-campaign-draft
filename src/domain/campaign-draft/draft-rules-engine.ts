import { parseNoteFilter } from "./note-keyword-filter";
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

function pickSkus(
  catalog: CatalogSku[],
  preset: SportPreset,
  filter: NoteFilterResult,
): { skuIds: string[]; surfaceOrder: SurfaceOrder; emptyCatalog: boolean } {
  const donation = catalog.find((s) => s.kind === "donation");
  let products = catalog.filter((s) => s.kind === "product");
  const emptyCatalog = products.length === 0;

  products = applyNoteFilter(products, filter);

  const tagged = products.filter((s) =>
    s.tags.some((t) => preset.defaultProductTags.includes(t)),
  );
  const pool = tagged.length > 0 ? tagged : products;
  const selectedProducts = pool.slice(0, MAX_PRODUCT_SKUS);

  const skuIds: string[] = [];
  if (donation) skuIds.push(donation.id);
  for (const p of selectedProducts) skuIds.push(p.id);

  const hasProduct = selectedProducts.length > 0;
  const surfaceOrder: SurfaceOrder = hasProduct
    ? "shop_first"
    : preset.defaultSurfaceOrder === "shop_first" && !hasProduct
      ? "donate_first"
      : preset.defaultSurfaceOrder;

  return { skuIds, surfaceOrder, emptyCatalog };
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
  const noteFilter = parseNoteFilter(brief.note);

  const rawGoal = brief.rosterSize * preset.dollarsPerPlayerCents;
  const goalCents = clampGoal(rawGoal, preset);

  const { skuIds, surfaceOrder } = pickSkus(catalog, preset, noteFilter);

  const dollarsPerPlayer = (preset.dollarsPerPlayerCents / 100).toFixed(0);
  const whyRules = [
    `Goal = ${brief.rosterSize} players × $${dollarsPerPlayer}/player = $${(goalCents / 100).toLocaleString("en-US")}`,
    `Preset: ${preset.displayName} v${preset.version}`,
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
