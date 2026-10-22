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
    expect(feeRateToBps(0.05)).toBe(500);
    expect(feeRateToBps(0.09)).toBe(900);
  });
});
