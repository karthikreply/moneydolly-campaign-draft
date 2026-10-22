import { describe, expect, it } from "vitest";
import { buildFeePreviewSamples } from "../src/domain/campaign-draft/fee-preview";
import { STUB_CATALOG } from "../src/domain/campaign-draft/stub-catalog";

describe("buildFeePreviewSamples", () => {
  it("shows donation program receives after fee", () => {
    const samples = buildFeePreviewSamples(STUB_CATALOG, 500);
    const donation = samples.find((s) => s.kind === "donation")!;
    expect(donation.supporterPaysCents).toBe(5000);
    expect(donation.programReceivesCents).toBe(4750);
    expect(donation.towardGoalCents).toBe(4750);
  });

  it("product shipping does not count toward goal", () => {
    const samples = buildFeePreviewSamples(
      STUB_CATALOG.filter((s) => s.id === "sku_vb_tee" || s.kind === "donation"),
    );
    const product = samples.find((s) => s.kind === "product")!;
    expect(product.towardGoalCents).toBe(800);
    expect(product.notTowardGoalNote).toMatch(/does not count toward the goal/i);
  });
});
