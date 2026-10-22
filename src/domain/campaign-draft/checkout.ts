import type { CatalogSku, CheckoutQuote, OrderLineInput } from "./types";

/**
 * Pure pricing. Shipping is never goal credit. Donation goal credit is net of the
 * operator's take rate (bps). Products credit their fixed group_credit_cents.
 */
export function quoteCheckout(
  catalog: CatalogSku[],
  offerProductIds: string[],
  lines: OrderLineInput[],
  donationCents: number,
  donationFeeBps: number,
): CheckoutQuote {
  const offered = new Set(offerProductIds);
  const byId = new Map(catalog.map((sku) => [sku.id, sku]));

  const priced = lines
    .filter((line) => line.qty > 0 && offered.has(line.productId))
    .map((line) => {
      const sku = byId.get(line.productId);
      if (!sku || sku.kind !== "product") return null;
      return {
        productId: sku.id,
        name: sku.name,
        qty: line.qty,
        unitCents: sku.retailCents,
        groupCreditCents: sku.groupCreditCents,
        shipCents: sku.shipHandlingCents,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  const subtotalCents =
    priced.reduce((sum, line) => sum + line.unitCents * line.qty, 0) +
    Math.max(0, donationCents);
  const shippingCents = priced.reduce((sum, line) => sum + line.shipCents * line.qty, 0);
  const productCredit = priced.reduce(
    (sum, line) => sum + line.groupCreditCents * line.qty,
    0,
  );
  const safeDonation = Math.max(0, Math.floor(donationCents));
  const donationFeeCents = Math.floor((safeDonation * donationFeeBps) / 10_000);
  const donationCredit = safeDonation - donationFeeCents;

  return {
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    goalCreditCents: productCredit + donationCredit,
    donationCents: safeDonation,
    donationFeeCents,
    lines: priced.map(({ shipCents: _ship, ...line }) => line),
  };
}
