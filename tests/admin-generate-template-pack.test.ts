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
  });
});
