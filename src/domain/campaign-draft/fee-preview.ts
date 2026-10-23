import type { CatalogSku, FeePreviewSample } from "./types";

/** Default donation take rate for preview samples (basis points). */
export const DEFAULT_DONATION_FEE_BPS = 500; // 5%

export function buildFeePreviewSamples(
  skus: CatalogSku[],
  donationFeeBps: number = DEFAULT_DONATION_FEE_BPS,
): FeePreviewSample[] {
  const samples: FeePreviewSample[] = [];

  const donationPay = 5000;
  const donationReceives = Math.floor(donationPay * (1 - donationFeeBps / 10000));
  samples.push({
    kind: "donation",
    label: "Sample $50 donation",
    supporterPaysCents: donationPay,
    programReceivesCents: donationReceives,
    towardGoalCents: donationReceives,
    notTowardGoalNote: null,
  });

  const product = skus.find((s) => s.kind === "product");
  if (product) {
    samples.push({
      kind: "product",
      label: product.name,
      supporterPaysCents: product.retailCents + product.shipHandlingCents,
      programReceivesCents: product.groupCreditCents,
      towardGoalCents: product.groupCreditCents,
      notTowardGoalNote: `Shipping/handling ($${(product.shipHandlingCents / 100).toFixed(2)}) does not count toward the goal.`,
    });
  }

  return samples;
}

export function formatCents(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
