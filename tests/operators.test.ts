import { describe, expect, it } from "vitest";
import { feeRateToBps, OPERATORS } from "../src/domain/operators";

describe("operator registry", () => {
  it("has two distinct white-label brands", () => {
    expect(OPERATORS.length).toBeGreaterThanOrEqual(2);
    const names = OPERATORS.map((operator) => operator.operatorName);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("Apex Youth Sports");
    expect(names).toContain("Victory Fundraising");
    for (const operator of OPERATORS) {
      expect(operator.primaryColor).toMatch(/^#/);
      expect(operator.logoUrl.startsWith("data:image/svg+xml")).toBe(true);
      expect(operator.customFeeRate).toBeGreaterThan(0);
      expect(operator.customFeeRate).toBeLessThan(1);
    }
    expect(OPERATORS[0].customFeeRate).not.toBe(OPERATORS[1].customFeeRate);
  });

  it("gives each vendor its own agent persona", () => {
    const personas = OPERATORS.map((operator) => operator.assistant);
    expect(new Set(personas.map((p) => p.name)).size).toBe(personas.length);
    for (const [index, persona] of personas.entries()) {
      expect(persona.greeting).toContain(persona.name);
      expect(persona.greeting).toContain(OPERATORS[index].operatorName.split(" ")[0]);
      expect(persona.voice.rate).toBeGreaterThan(0);
      expect(persona.voice.pitch).toBeGreaterThan(0);
    }
    expect(feeRateToBps(0.05)).toBe(500);
    expect(feeRateToBps(0.09)).toBe(900);
  });
});
