import { describe, expect, it } from "vitest";
import { runDraftRules } from "../src/domain/campaign-draft/draft-rules-engine";
import { generateDraftCopy } from "../src/domain/campaign-draft/draft-copy-generator";
import { createPresetStore, resolveSportPreset } from "../src/domain/campaign-draft/sport-presets";
import { STUB_CATALOG } from "../src/domain/campaign-draft/stub-catalog";
import { resolveThemePack } from "../src/domain/campaign-draft/theme-packs";

describe("theme packs", () => {
  it("resolves known packs and defaults unknown", () => {
    expect(resolveThemePack("spirit_week").name).toBe("Spirit week");
    expect(resolveThemePack("community").name).toBe("Community");
    expect(resolveThemePack("community").headlineVerb).toBe("Stand with");
    expect(resolveThemePack("nope").key).toBe("classic_season");
  });

  it("spirit week prefers apparel/spirit tagged SKUs", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "volleyball");
    const result = runDraftRules({
      brief: {
        sport: "volleyball",
        windowStart: "2026-03-01",
        windowEnd: "2026-04-15",
        rosterSize: 18,
        note: "",
        orgDisplayName: "Lincoln VB",
        themeKey: "spirit_week",
      },
      preset,
      catalog: STUB_CATALOG,
    });
    expect(result.whyRules).toMatch(/Spirit week/i);
    const products = result.skuIds
      .map((id) => STUB_CATALOG.find((s) => s.id === id)!)
      .filter((s) => s.kind === "product");
    expect(
      products.some((p) => p.tags.includes("spirit") || p.tags.includes("apparel")),
    ).toBe(true);
  });

  it("copy uses theme headline verb", async () => {
    const copy = await generateDraftCopy({
      brief: {
        sport: "volleyball",
        windowStart: "2026-03-01",
        windowEnd: "2026-04-15",
        rosterSize: 18,
        note: "",
        orgDisplayName: "Lincoln VB",
        themeKey: "championship_push",
      },
      goalCents: 270000,
      catalog: STUB_CATALOG,
      skuIds: ["sku_donation", "sku_vb_ball"],
    });
    expect(copy.headline).toMatch(/Help push/i);
    expect(copy.whyDraft).toMatch(/Championship push/i);
  });
});
