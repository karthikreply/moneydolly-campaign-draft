import { describe, expect, it } from "vitest";
import { contrast, paletteMeetsAaa } from "../src/domain/admin/aaa-palette";
import {
  assertGeneratedPackAaa,
  generateTemplatePack,
} from "../src/domain/admin/generate-template-pack";

const LACROSSE_PROMPT =
  "Create a Spring Lacrosse template with neon green accents, min goal $2,000, max $8,000, and 5 branded merch items under $35.";

describe("generateTemplatePack", () => {
  it("mints the lacrosse example with goals, SKUs, and AAA neon green theme", () => {
    const result = generateTemplatePack(LACROSSE_PROMPT, { operatorId: "op1" });

    expect(result.canPublish).toBe(true);
    expect(result.pack.sportPreset.sportKey).toBe("lacrosse");
    expect(result.pack.sportPreset.minGoalCents).toBe(200_000);
    expect(result.pack.sportPreset.maxGoalCents).toBe(800_000);
    expect(result.pack.catalogSkus).toHaveLength(5);
    expect(result.pack.catalogSkus.every((s) => s.retailCents <= 3_500)).toBe(true);
    expect(result.pack.catalogSkus.every((s) => s.kind === "product")).toBe(true);

    const { colors } = result.pack.theme;
    expect(paletteMeetsAaa(colors)).toBe(true);
    assertGeneratedPackAaa(result.pack);

    const surfaces = [colors.background, colors.backgroundAlt, colors.panel];
    for (const surface of surfaces) {
      expect(contrast(colors.accent, surface)).toBeGreaterThanOrEqual(7);
    }

    expect(result.reply.toLowerCase()).toContain("lacrosse");
    expect(result.reply).toMatch(/5 items/i);
    expect(result.reply).toMatch(/under \$35/i);
  });

  it("asks for sport when missing and blocks publish", () => {
    const result = generateTemplatePack("Neon green theme with 5 merch items under $25");
    expect(result.canPublish).toBe(false);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.pack.sportPreset.sportKey).toBe("");
    expect(result.steps.find((s) => s.id === "sport")?.status).toBe("missing");

    const fixed = generateTemplatePack(result.refinements[0].prompt);
    expect(fixed.canPublish).toBe(true);
    expect(fixed.pack.sportPreset.sportKey).toBe("lacrosse");
  });

  it("never repeats an item when the preferred kind runs short", () => {
    const { pack } = generateTemplatePack(LACROSSE_PROMPT);
    const names = pack.catalogSkus.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("reports each build step with found vs assumed", () => {
    const full = generateTemplatePack(LACROSSE_PROMPT);
    expect(full.steps.map((s) => s.id)).toEqual(["sport", "look", "goals", "catalog", "ready"]);
    expect(full.steps.every((s) => s.status === "found")).toBe(true);
    expect(full.steps.find((s) => s.id === "look")?.detail).toMatch(/contrast \d+\.\d:1/i);

    const sparse = generateTemplatePack("Hockey template");
    const status = Object.fromEntries(sparse.steps.map((s) => [s.id, s.status]));
    expect(status).toMatchObject({ look: "assumed", goals: "assumed", catalog: "assumed" });
  });

  it("refinements rewrite the sentence and rebuild with the change", () => {
    const first = generateTemplatePack(LACROSSE_PROMPT);
    const byId = Object.fromEntries(first.refinements.map((r) => [r.id, r]));

    const fall = generateTemplatePack(byId.season.prompt);
    expect(fall.pack.theme.name).toBe("Fall Lacrosse");

    const cheaper = generateTemplatePack(byId.cap.prompt);
    expect(cheaper.pack.catalogSkus.every((s) => s.retailCents <= 2_500)).toBe(true);

    const six = generateTemplatePack(byId.count.prompt);
    expect(six.pack.catalogSkus).toHaveLength(6);

    const mixed = generateTemplatePack(byId.mix.prompt);
    expect(mixed.pack.catalogSkus.some((s) => s.tags.includes("apparel"))).toBe(true);

    const blue = generateTemplatePack(byId.color.prompt);
    expect(blue.reply).toMatch(/blue/);
    expect(paletteMeetsAaa(blue.pack.theme.colors)).toBe(true);
  });
});
