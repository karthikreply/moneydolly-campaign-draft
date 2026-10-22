import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO, getCampaignDraftService } from "@/lib/service";

const patchSchema = z.object({
  goalCents: z.number().int().positive().optional(),
  surfaceOrder: z.enum(["shop_first", "donate_first"]).optional(),
  skuIds: z.array(z.string()).optional(),
  headline: z.string().optional(),
  supportingLine: z.string().optional(),
  whyDraft: z.string().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const draft = getCampaignDraftService().getDraft(DEMO.operatorId, id);
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(draft);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const patch = patchSchema.parse(await req.json());
    const draft = getCampaignDraftService().updateDraft(DEMO.operatorId, id, patch);
    return NextResponse.json(draft);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
