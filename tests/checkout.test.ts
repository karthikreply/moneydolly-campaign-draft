import { describe, expect, it } from "vitest";
import { quoteCheckout } from "../src/domain/campaign-draft/checkout";
import { slugify, uniqueSlug } from "../src/domain/campaign-draft/slug";
import { STUB_CATALOG } from "../src/domain/campaign-draft/stub-catalog";

describe("quoteCheckout", () => {
  const offers = ["sku_donation", "sku_vb_tee", "sku_vb_lanyard"];

  it("credits product group credit and nets the donation fee; shipping never counts", () => {
    const quote = quoteCheckout(
      STUB_CATALOG,
      offers,
      [{ productId: "sku_vb_tee", qty: 2 }],
      5000,
      500,
    );
    expect(quote.subtotalCents).toBe(2200 * 2 + 5000);
    expect(quote.shippingCents).toBe(499 * 2);
    expect(quote.totalCents).toBe(quote.subtotalCents + quote.shippingCents);
    expect(quote.donationFeeCents).toBe(250);
    expect(quote.goalCreditCents).toBe(800 * 2 + 4750);
  });

  it("ignores SKUs that are not offered on this campaign", () => {
    const quote = quoteCheckout(
      STUB_CATALOG,
      offers,
      [{ productId: "sku_bb_hoodie", qty: 1 }],
      0,
      500,
    );
    expect(quote.lines).toHaveLength(0);
    expect(quote.totalCents).toBe(0);
    expect(quote.goalCreditCents).toBe(0);
  });

  it("clamps negative donations to zero", () => {
    const quote = quoteCheckout(STUB_CATALOG, offers, [], -200, 500);
    expect(quote.donationCents).toBe(0);
    expect(quote.goalCreditCents).toBe(0);
  });
});

describe("slugs", () => {
  it("makes url-safe slugs and de-duplicates", () => {
    expect(slugify("Rally for Lincoln Volleyball!")).toBe("rally-for-lincoln-volleyball");
    const taken = new Set(["lincoln", "lincoln-2"]);
    expect(uniqueSlug("lincoln", (slug) => taken.has(slug))).toBe("lincoln-3");
  });
});
