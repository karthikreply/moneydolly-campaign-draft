import { NextResponse } from "next/server";
import { z } from "zod";
import { feeRateToBps, findOperator } from "@/domain/operators";
import { getCampaignDraftService } from "@/lib/service";

/** Number inputs can submit NaN, which JSON turns into null. Treat that as zero. */
const cents = z
  .union([z.number(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0));

const schema = z.object({
  campaignSlug: z.string().trim().min(1),
  participantSlug: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  operatorId: z.string().trim().min(1),
  supporterName: z.string().trim().min(1),
  supporterEmail: z.string().trim().min(3),
  lines: z.array(
    z.object({
      productId: z.string().trim().min(1),
      qty: cents,
    }),
  ),
  donationCents: cents.default(0),
  mode: z.enum(["quote", "pay"]).default("quote"),
});

/**
 * Mock checkout. No card fields are posted here; a production build redirects to
 * Stripe Checkout and records the order from the webhook instead.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.path.join(".") || "body").join(", ");
    return NextResponse.json(
      { error: detail ? `Check ${detail} and try again.` : "Invalid checkout payload" },
      { status: 400 },
    );
  }
  const { mode, operatorId, ...input } = parsed.data;
  const bps = feeRateToBps(findOperator(operatorId).customFeeRate);
  const svc = getCampaignDraftService();
  try {
    if (mode === "quote") {
      return NextResponse.json({ quote: svc.quote(input, bps) });
    }
    const order = svc.placeOrder(input, bps);
    const progress = svc.getProgress(order.campaignId, order.participantId);
    return NextResponse.json({ order, progress }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
