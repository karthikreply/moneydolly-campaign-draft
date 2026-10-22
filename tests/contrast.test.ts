import { describe, expect, it } from "vitest";
import { THEME_LIST } from "../src/domain/campaign-draft/theme-packs";
import { OPERATORS } from "../src/domain/operators";

/** WCAG 2.2 relative luminance. AAA body text is 7:1; large/UI text is 4.5:1. */
function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((pair) => {
      const value = parseInt(pair, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("theme contrast for older and low-vision readers", () => {
  it("keeps body, secondary, and accent text at AAA against every theme surface", () => {
    for (const theme of THEME_LIST) {
      const { ink, muted, accent, accentInk, background, backgroundAlt, panel } = theme.colors;
      const surfaces = [background, backgroundAlt, panel];
      for (const surface of surfaces) {
        expect(contrast(ink, surface), `${theme.key} ink on ${surface}`).toBeGreaterThanOrEqual(7);
        expect(contrast(muted, surface), `${theme.key} muted on ${surface}`).toBeGreaterThanOrEqual(7);
        expect(contrast(accent, surface), `${theme.key} accent on ${surface}`).toBeGreaterThanOrEqual(7);
      }
      expect(contrast(accentInk, accent), `${theme.key} button label`).toBeGreaterThanOrEqual(7);
    }
  });

  it("keeps white operator-bar text at AAA on each brand color", () => {
    for (const operator of OPERATORS) {
      expect(contrast("#ffffff", operator.primaryColor), operator.operatorName).toBeGreaterThanOrEqual(7);
    }
  });
});
