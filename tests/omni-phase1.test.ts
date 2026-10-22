import { describe, expect, it } from "vitest";
import { normalizeNumberWords } from "../src/domain/campaign-draft/number-words";
import { extractBriefSlots } from "../src/domain/campaign-draft/slot-extractor";
import { scoreBriefCompleteness } from "../src/domain/campaign-draft/completeness";
import { hydrateOmniBrief } from "../src/domain/campaign-draft/omni-hydrate";
import { STUB_CATALOG } from "../src/domain/campaign-draft/stub-catalog";
import {
  createPresetStore,
  resolveSportPreset,
} from "../src/domain/campaign-draft/sport-presets";

const NOW = new Date("2026-10-22T12:00:00.000Z");

describe("phase 1 seed catalog", () => {
  it("has at least 8 unique SKUs including a donation line", () => {
    const ids = STUB_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    expect(STUB_CATALOG.some((s) => s.kind === "donation")).toBe(true);
  });
});

describe("number word normalizer", () => {
  it("rewrites roster and price words into digits", () => {
    expect(
      normalizeNumberWords(
        "eighteen players, keep items under twenty five dollars",
      ),
    ).toBe("18 players, keep items under $25");
  });
});

describe("structured slot extractor", () => {
  it("pulls sport, roster, window, theme, org, and note from one utterance", () => {
    const slots = extractBriefSlots(
      "Lincoln volleyball, 18 players, March 1 to April 15, spirit week, keep items under $25",
      NOW,
    );
    expect(slots.sport).toBe("volleyball");
    expect(slots.rosterSize).toBe(18);
    expect(slots.orgDisplayName).toBe("Lincoln");
    expect(slots.themeKey).toBe("spirit_week");
    expect(slots.windowStart).toBe("2027-03-01");
    expect(slots.windowEnd).toBe("2027-04-15");
    expect(slots.note).toMatch(/under \$25/i);
  });
});

describe("completeness gate", () => {
  it("stays under 0.65 without a third required slot", () => {
    const score = scoreBriefCompleteness({
      sport: "volleyball",
      rosterSize: 18,
    });
    expect(score.score).toBeCloseTo(0.55);
    expect(score.canDraft).toBe(false);
    expect(score.missingSlots).toEqual(
      expect.arrayContaining(["window", "orgName", "themePack"]),
    );
  });

  it("passes when sport, roster, and any one secondary slot are present", () => {
    const byOrg = scoreBriefCompleteness({
      sport: "volleyball",
      rosterSize: 18,
      orgDisplayName: "Lincoln",
    });
    expect(byOrg.score).toBeCloseTo(0.7);
    expect(byOrg.canDraft).toBe(true);

    const byTheme = scoreBriefCompleteness({
      sport: "volleyball",
      rosterSize: 18,
      themeKey: "spirit_week",
    });
    expect(byTheme.score).toBeCloseTo(0.65);
    expect(byTheme.canDraft).toBe(true);
  });

  it("blocks a passing score that is missing sport or roster", () => {
    const noSport = scoreBriefCompleteness({
      rosterSize: 18,
      windowStart: "2027-03-01",
      windowEnd: "2027-04-15",
      orgDisplayName: "Lincoln",
      themeKey: "spirit_week",
    });
    expect(noSport.score).toBeCloseTo(0.7);
    expect(noSport.canDraft).toBe(false);

    const noRoster = scoreBriefCompleteness({
      sport: "volleyball",
      windowStart: "2027-03-01",
      windowEnd: "2027-04-15",
      orgDisplayName: "Lincoln",
    });
    expect(noRoster.score).toBeCloseTo(0.65);
    expect(noRoster.canDraft).toBe(false);
  });
});

describe("deterministic hydrate", () => {
  it("does not run rules below the gate", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "volleyball");
    const result = hydrateOmniBrief({
      utterance: "volleyball eighteen players",
      preset,
      catalog: STUB_CATALOG,
      now: NOW,
    });
    expect(result.canDraft).toBe(false);
    expect(result.rules).toBeUndefined();
    expect(result.brief).toBeUndefined();
    expect(result.extractedSlots.sport).toBe("volleyball");
    expect(result.extractedSlots.rosterSize).toBe(18);
    expect(result.missingSlots).toEqual(
      expect.arrayContaining(["window", "orgName", "themePack"]),
    );
  });

  it("keeps extracted slots when sport is missing", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "volleyball");
    const result = hydrateOmniBrief({
      utterance: "eighteen players, March 1 to April 15, spirit week",
      preset,
      catalog: STUB_CATALOG,
      now: NOW,
    });
    expect(result.canDraft).toBe(false);
    expect(result.extractedSlots.rosterSize).toBe(18);
    expect(result.extractedSlots.windowStart).toBe("2027-03-01");
    expect(result.extractedSlots.themeKey).toBe("spirit_week");
    expect(result.missingSlots).toContain("sport");
    expect(result.rules).toBeUndefined();
  });

  it("auto-hydrates clamped goal, regex note filter, and a 4-6 SKU cap", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "volleyball");
    const result = hydrateOmniBrief({
      utterance:
        "Lincoln volleyball, eighteen players, March 1 to April 15, spirit week, keep items under twenty five dollars",
      preset,
      catalog: STUB_CATALOG,
      now: NOW,
    });
    expect(result.canDraft).toBe(true);
    expect(result.rules).toBeDefined();
    expect(result.defaultedFields).toEqual([]);
    expect(result.rules!.goalCents).toBe(18 * 15000);
    expect(result.rules!.noteFilter).toMatchObject({
      type: "max_price",
      amountCents: 2500,
    });
    const products = result.rules!.skuIds.filter((id) => id !== "sku_donation");
    expect(products.length).toBeGreaterThanOrEqual(1);
    expect(products.length).toBeLessThanOrEqual(5);
    expect(result.rules!.skuIds.length).toBeLessThanOrEqual(6);
    expect(
      products.every((id) => {
        const sku = STUB_CATALOG.find((s) => s.id === id)!;
        return sku.retailCents <= 2500;
      }),
    ).toBe(true);
  });

  it("defaults a spoken start to a 14-day window and flags the end", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "volleyball");
    const result = hydrateOmniBrief({
      utterance: "Lincoln volleyball, 18 players, starting March 15",
      preset,
      catalog: STUB_CATALOG,
      now: NOW,
    });
    expect(result.canDraft).toBe(true);
    expect(result.brief?.windowStart).toBe("2027-03-15");
    expect(result.brief?.windowEnd).toBe("2027-03-28");
    expect(result.defaultedFields).toContain("windowEnd");
    expect(result.defaultedFields).not.toContain("windowDays");
  });

  it("hydrates Program, Classic season, and 14 days from today when those slots are unspoken", () => {
    const store = createPresetStore();
    const preset = resolveSportPreset(store, "op1", "volleyball");
    const result = hydrateOmniBrief({
      utterance: "volleyball eighteen players spirit week",
      preset,
      catalog: STUB_CATALOG,
      now: NOW,
    });
    expect(result.canDraft).toBe(true);
    expect(result.brief?.orgDisplayName).toBe("Program");
    expect(result.brief?.themeKey).toBe("spirit_week");
    expect(result.brief?.windowStart).toBe("2026-10-22");
    expect(result.brief?.windowEnd).toBe("2026-11-04");
    expect(result.defaultedFields).toEqual(
      expect.arrayContaining(["orgName", "windowDays"]),
    );
    expect(result.defaultedFields).not.toContain("themePack");
  });

  it("treats a bare month as the 1st and rolls it forward in UTC", () => {
    const slots = extractBriefSlots("volleyball 18 players in March", NOW);
    expect(slots.windowStart).toBe("2027-03-01");
    expect(slots.windowEndMentioned).toBe(false);
  });
});
