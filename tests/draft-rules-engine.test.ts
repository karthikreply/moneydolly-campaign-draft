import { describe, expect, it } from "vitest";
import { runDraftRules } from "../src/domain/campaign-draft/draft-rules-engine";
import { createPresetStore, resolveSportPreset } from "../src/domain/campaign-draft/sport-presets";
import { STUB_CATALOG } from "../src/domain/campaign-draft/stub-catalog";
import type { CatalogSku } from "../src/domain/campaign-draft/types";

const briefBase = {
  sport: "volleyball",
  windowStart: "2026-03-01",
  windowEnd: "2026-04-15",
  rosterSize: 20,
  note: "",
  orgDisplayName: "Lincoln VB",
};

describe("runDraftRules", () => {
  it("computes goal from roster × $/player", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "volleyball");
    const result = runDraftRules({
      brief: briefBase,
      preset,
      catalog: STUB_CATALOG,
    });
    expect(result.goalCents).toBe(20 * 15000);
    expect(result.skuIds).toContain("sku_donation");
    expect(result.skuIds.some((id) => id.startsWith("sku_vb_"))).toBe(true);
    expect(result.surfaceOrder).toBe("shop_first");
  });

  it("applies under $25 price filter", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "volleyball");
    const result = runDraftRules({
      brief: { ...briefBase, note: "Keep items under $25" },
      preset,
      catalog: STUB_CATALOG,
    });
    expect(result.noteFilter.type).toBe("max_price");
    const products = result.skuIds
      .map((id) => STUB_CATALOG.find((s) => s.id === id)!)
      .filter((s) => s.kind === "product");
    expect(products.every((p) => p.retailCents <= 2500)).toBe(true);
  });

  it("unmatched note does not invent a filter", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "volleyball");
    const result = runDraftRules({
      brief: { ...briefBase, note: "Make it festive" },
      preset,
      catalog: STUB_CATALOG,
    });
    expect(result.noteFilter).toEqual({
      type: "none",
      label: "No price filter detected",
    });
  });

  it("empty catalog yields donation only", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "volleyball");
    const catalog: CatalogSku[] = [
      {
        id: "sku_donation",
        name: "Donate",
        retailCents: 0,
        groupCreditCents: 0,
        shipHandlingCents: 0,
        tags: ["donation"],
        kind: "donation",
      },
    ];
    const result = runDraftRules({ brief: briefBase, preset, catalog });
    expect(result.skuIds).toEqual(["sku_donation"]);
    expect(result.surfaceOrder).toBe("donate_first");
  });
});
